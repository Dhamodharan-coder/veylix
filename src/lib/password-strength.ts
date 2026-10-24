// Lightweight strength estimate (no external dictionary): entropy from the
// character pool, minus penalties for common passwords and patterns.

const COMMON = new Set([
  "password", "123456", "12345678", "123456789", "1234567890", "qwerty", "qwerty123", "abc123", "111111", "123123",
  "letmein", "welcome", "admin", "iloveyou", "monkey", "dragon", "football", "baseball", "sunshine", "princess",
  "passw0rd", "password1", "password123", "master", "login", "secret", "trustno1", "000000", "654321", "superman",
  "qwertyuiop", "asdfghjkl", "zxcvbnm", "changeme", "default", "root", "test", "guest", "hello", "freedom",
]);

const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; bits: number; hints: string[] };

const LABELS = ["Very weak", "Weak", "Fair", "Strong", "Very strong"] as const;

export function passwordStrength(password: string): Strength {
  if (!password) return { score: 0, label: LABELS[0], bits: 0, hints: ["Enter a password"] };
  const hints: string[] = [];
  const lower = password.toLowerCase();

  let pool = 0;
  if (/[a-z]/.test(password)) pool += 26;
  if (/[A-Z]/.test(password)) pool += 26;
  if (/\d/.test(password)) pool += 10;
  if (/[^A-Za-z0-9]/.test(password)) pool += 33;
  let bits = password.length * Math.log2(Math.max(pool, 1));

  if (COMMON.has(lower) || COMMON.has(lower.replace(/[^a-z0-9]/g, ""))) {
    bits = Math.min(bits, 10);
    hints.push("This is a very common password");
  }
  if (/(.)\1{2,}/.test(password)) {
    bits -= 10;
    hints.push("Avoid repeated characters");
  }
  for (const seq of SEQUENCES) {
    for (let i = 0; i + 4 <= seq.length; i++) {
      const chunk = seq.slice(i, i + 4);
      if (lower.includes(chunk) || lower.includes([...chunk].reverse().join(""))) {
        bits -= 12;
        hints.push("Avoid sequences like abcd or 1234");
        break;
      }
    }
  }
  if (password.length < 12) hints.push("Use at least 12 characters");
  if (pool < 60 && password.length < 20) hints.push("Mix upper and lower case, numbers and symbols");

  const score = (bits < 28 ? 0 : bits < 45 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4) as Strength["score"];
  return { score, label: LABELS[score], bits: Math.max(0, Math.round(bits)), hints: [...new Set(hints)] };
}
