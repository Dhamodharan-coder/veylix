// Fingerprint / Touch ID / Windows Hello unlock via WebAuthn's PRF extension.
//
// The platform authenticator holds a secret that it only releases after the
// user verifies with their fingerprint. PRF turns that secret + our salt into
// 32 bytes we use as a key to encrypt a local copy of the vault private key.
// Nothing is unlockable without the fingerprint, and the master password is
// still never stored.

import { fromB64, randomBytes, toB64 } from "../../src/lib/vault-crypto";

type PrfInputs = { prf?: { eval?: { first: BufferSource } } };
type PrfOutputs = { prf?: { enabled?: boolean; results?: { first?: ArrayBuffer } } };

export const biometricLabel = () =>
  /Mac|iPhone|iPad/.test(navigator.userAgent) ? "Touch ID" : /Windows/.test(navigator.userAgent) ? "Windows Hello" : "fingerprint";

export async function biometricSupported(): Promise<boolean> {
  return typeof PublicKeyCredential !== "undefined" && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
}

const prfResult = (cred: PublicKeyCredential) => (cred.getClientExtensionResults() as PrfOutputs).prf?.results?.first;

/** Asks for the fingerprint and returns the PRF output (base64). */
export async function evaluateBiometric(credentialId: string, salt: string): Promise<string> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ type: "public-key", id: fromB64(credentialId) }],
      userVerification: "required",
      timeout: 60_000,
      extensions: { prf: { eval: { first: fromB64(salt) } } } as AuthenticationExtensionsClientInputs & PrfInputs,
    },
  })) as PublicKeyCredential | null;
  const out = cred && prfResult(cred);
  if (!out) throw new Error(`${biometricLabel()} didn't return a key. This device may not support biometric unlock.`);
  return toB64(out);
}

/** Creates a device credential and returns what's needed to enable biometric unlock. */
export async function registerBiometric(email: string): Promise<{ credentialId: string; salt: string; prf: string }> {
  const salt = toB64(randomBytes(32));
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: "Veylix" },
      user: { id: randomBytes(16), name: email, displayName: `Veylix (${email})` },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required", residentKey: "preferred" },
      timeout: 60_000,
      extensions: { prf: { eval: { first: fromB64(salt) } } } as AuthenticationExtensionsClientInputs & PrfInputs,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Setup was cancelled");

  const results = cred.getClientExtensionResults() as PrfOutputs;
  if (results.prf?.enabled === false) throw new Error(`${biometricLabel()} on this device doesn't support secure vault unlock (WebAuthn PRF).`);
  const credentialId = toB64(cred.rawId);

  // Some authenticators return the PRF output at creation; others need a second prompt.
  const first = prfResult(cred);
  const prf = first ? toB64(first) : await evaluateBiometric(credentialId, salt);
  return { credentialId, salt, prf };
}
