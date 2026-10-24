/**
 * Checks passwords against Have I Been Pwned's Pwned Passwords database using
 * k-anonymity: only the first 5 hex characters of the password's SHA-1 hash
 * are sent; the match happens locally. The password itself never leaves the
 * device. Runs in the browser and in the extension (no Node/Next imports).
 *
 * https://haveibeenpwned.com/API/v3#PwnedPasswords
 */

const RANGE_URL = "https://api.pwnedpasswords.com/range/";

// prefix → (suffix → count); responses are cached for the page's lifetime.
const cache = new Map<string, Promise<Map<string, number>>>();

async function sha1Hex(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(text)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function fetchRange(prefix: string): Promise<Map<string, number>> {
  let p = cache.get(prefix);
  if (!p) {
    p = fetch(`${RANGE_URL}${prefix}`, { headers: { "Add-Padding": "true" } }).then(async (res) => {
      if (!res.ok) throw new Error(`Breach check failed (${res.status})`);
      const map = new Map<string, number>();
      for (const line of (await res.text()).split("\n")) {
        const [suffix, count] = line.trim().split(":");
        // Padding entries have a count of 0.
        if (suffix && Number(count) > 0) map.set(suffix, Number(count));
      }
      return map;
    });
    p.catch(() => cache.delete(prefix));
    cache.set(prefix, p);
  }
  return p;
}

/** How many times this password appears in known data breaches (0 = not found). */
export async function pwnedCount(password: string): Promise<number> {
  if (!password) return 0;
  const hash = await sha1Hex(password);
  return (await fetchRange(hash.slice(0, 5))).get(hash.slice(5)) ?? 0;
}

export const formatBreachCount = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}K` : String(n);
