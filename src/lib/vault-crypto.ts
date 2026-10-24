/**
 * Zero-knowledge crypto for the Vault, run in the browser with WebCrypto.
 *
 * master password ─PBKDF2(600k)→ bits ─HKDF→ wrapping key (AES-GCM)
 *   wrapping key encrypts the user's RSA-OAEP private key
 *   RSA public key encrypts folder keys / directly-shared item keys
 *   folder key (AES-GCM) encrypts item keys
 *   item key (AES-GCM) encrypts the item's fields
 *
 * Symmetric ciphertext format: "v1.<iv b64>.<ciphertext b64>"
 * RSA ciphertext format:       "r1.<ciphertext b64>"
 */

export const KDF_ITERATIONS = 600_000;

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

// ---------- encoding ----------

export function toB64(data: ArrayBuffer | Uint8Array): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export const randomBytes = (n: number) => globalThis.crypto.getRandomValues(new Uint8Array(n));

// ---------- AES-GCM ----------

async function aesEncrypt(key: CryptoKey, plaintext: Uint8Array<ArrayBuffer>): Promise<string> {
  const iv = randomBytes(12);
  const ct = await subtle().encrypt({ name: "AES-GCM", iv }, key, plaintext);
  return `v1.${toB64(iv)}.${toB64(ct)}`;
}

async function aesDecrypt(key: CryptoKey, payload: string): Promise<Uint8Array<ArrayBuffer>> {
  const [version, iv, ct] = payload.split(".");
  if (version !== "v1" || !iv || !ct) throw new Error("Unsupported ciphertext format");
  return new Uint8Array(await subtle().decrypt({ name: "AES-GCM", iv: fromB64(iv) }, key, fromB64(ct)));
}

export const encryptString = (key: CryptoKey, text: string) => aesEncrypt(key, enc.encode(text));
export const decryptString = async (key: CryptoKey, payload: string) => dec.decode(await aesDecrypt(key, payload));
export const encryptJSON = (key: CryptoKey, value: unknown) => encryptString(key, JSON.stringify(value));
export const decryptJSON = async <T>(key: CryptoKey, payload: string): Promise<T> => JSON.parse(await decryptString(key, payload));

// ---------- master password → wrapping key ----------

export async function deriveWrappingKey(masterPassword: string, saltB64: string, iterations: number): Promise<CryptoKey> {
  const material = await subtle().importKey("raw", enc.encode(masterPassword.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  const bits = await subtle().deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromB64(saltB64), iterations }, material, 256);
  const hkdf = await subtle().importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return subtle().deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(32), info: enc.encode("veylix-vault-wrap-v1") },
    hkdf,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

// ---------- user key pair ----------

const RSA = { name: "RSA-OAEP", hash: "SHA-256" } as const;

export type VaultKeyMaterial = {
  kdfSalt: string;
  kdfIterations: number;
  publicKey: string;
  encryptedPrivateKey: string;
};

/** First-time setup: new key pair, private key sealed with the master password. */
export async function createVaultKeys(masterPassword: string): Promise<{ material: VaultKeyMaterial; privateKey: CryptoKey; publicKey: CryptoKey }> {
  const pair = await subtle().generateKey({ ...RSA, modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) }, true, ["encrypt", "decrypt"]);
  const kdfSalt = toB64(randomBytes(16));
  const wrappingKey = await deriveWrappingKey(masterPassword, kdfSalt, KDF_ITERATIONS);
  const pkcs8 = new Uint8Array(await subtle().exportKey("pkcs8", pair.privateKey));
  return {
    material: {
      kdfSalt,
      kdfIterations: KDF_ITERATIONS,
      publicKey: toB64(await subtle().exportKey("spki", pair.publicKey)),
      encryptedPrivateKey: await aesEncrypt(wrappingKey, pkcs8),
    },
    privateKey: pair.privateKey,
    publicKey: pair.publicKey,
  };
}

/** Unlock: throws if the master password is wrong (AES-GCM authentication fails). */
export async function unlockPrivateKey(masterPassword: string, account: VaultKeyMaterial): Promise<CryptoKey> {
  const wrappingKey = await deriveWrappingKey(masterPassword, account.kdfSalt, account.kdfIterations);
  let pkcs8: Uint8Array<ArrayBuffer>;
  try {
    pkcs8 = await aesDecrypt(wrappingKey, account.encryptedPrivateKey);
  } catch {
    throw new Error("Incorrect master password");
  }
  return subtle().importKey("pkcs8", pkcs8, RSA, false, ["decrypt"]);
}

/** Re-seal the private key under a new master password (data keys are untouched). */
export async function rewrapPrivateKey(oldPassword: string, newPassword: string, account: VaultKeyMaterial): Promise<Pick<VaultKeyMaterial, "kdfSalt" | "kdfIterations" | "encryptedPrivateKey">> {
  const oldKey = await deriveWrappingKey(oldPassword, account.kdfSalt, account.kdfIterations);
  let pkcs8: Uint8Array<ArrayBuffer>;
  try {
    pkcs8 = await aesDecrypt(oldKey, account.encryptedPrivateKey);
  } catch {
    throw new Error("Current master password is incorrect");
  }
  const kdfSalt = toB64(randomBytes(16));
  const newKey = await deriveWrappingKey(newPassword, kdfSalt, KDF_ITERATIONS);
  return { kdfSalt, kdfIterations: KDF_ITERATIONS, encryptedPrivateKey: await aesEncrypt(newKey, pkcs8) };
}

export const importPublicKey = (spkiB64: string) => subtle().importKey("spki", fromB64(spkiB64), RSA, false, ["encrypt"]);

// ---------- folder & item keys ----------

/** New random AES-256 key (extractable so it can be shared with other users). */
export const generateDataKey = () => subtle().generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);

const importDataKey = (raw: Uint8Array<ArrayBuffer>) => subtle().importKey("raw", raw, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
const exportDataKey = async (key: CryptoKey) => new Uint8Array(await subtle().exportKey("raw", key));

/** Encrypt a data key so only the holder of `publicKey`'s private key can use it. */
export async function sealKeyForUser(key: CryptoKey, publicKey: CryptoKey | string): Promise<string> {
  const pub = typeof publicKey === "string" ? await importPublicKey(publicKey) : publicKey;
  return `r1.${toB64(await subtle().encrypt(RSA, pub, await exportDataKey(key)))}`;
}

export async function openKeyForUser(sealed: string, privateKey: CryptoKey): Promise<CryptoKey> {
  const [version, ct] = sealed.split(".");
  if (version !== "r1" || !ct) throw new Error("Unsupported key format");
  return importDataKey(new Uint8Array(await subtle().decrypt(RSA, privateKey, fromB64(ct))));
}

/** Encrypt a data key under another data key (item key under folder key). */
export async function wrapKey(key: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
  return aesEncrypt(wrappingKey, await exportDataKey(key));
}

export async function unwrapKey(wrapped: string, wrappingKey: CryptoKey): Promise<CryptoKey> {
  return importDataKey(await aesDecrypt(wrappingKey, wrapped));
}

// ---------- misc ----------

export async function sha256Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await subtle().digest("SHA-256", enc.encode(text)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
}
