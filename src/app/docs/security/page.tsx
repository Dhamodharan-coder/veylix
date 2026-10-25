import type { Metadata } from "next";
import { C, Callout, DocHeader, DocTable, H2, H3 } from "../components";
import { GITHUB_URL } from "../nav";

export const metadata: Metadata = {
  title: "Security",
  description: "How Veylix protects your data: AES-256-GCM encryption for variables, hashed API tokens, rate limiting and a zero-knowledge password vault.",
};

export default function Security() {
  return (
    <>
      <DocHeader eyebrow="Guides" title="Security">
        How Veylix protects your variables, tokens and passwords, and what it deliberately can and can&apos;t see.
      </DocHeader>

      <H2>Environment variables</H2>
      <ul>
        <li>
          Every value is encrypted with <strong>AES-256-GCM</strong> before it&apos;s stored. Someone with a copy of the database sees only ciphertext.
        </li>
        <li>Values are decrypted only when you reveal or export them in the app, or request them with a valid token.</li>
        <li>Every request checks that you own the project, and tokens only reach their creator&apos;s projects.</li>
        <li>All traffic uses HTTPS, and API responses with variables are never cached.</li>
      </ul>
      <Callout title="Why server-side encryption?">
        The CLI and CI pipelines must read variables with just a token, with no person present to type a password. So the server holds the encryption
        key for variables. The password vault below works differently.
      </Callout>

      <H2>API tokens</H2>
      <ul>
        <li>Tokens are 256-bit random values. The server looks them up by their <strong>SHA-256 hash</strong>.</li>
        <li>The token value is also stored encrypted, so its owner can copy it again.</li>
        <li>Tokens can be read-only, limited to one project or environment, and set to expire.</li>
        <li>The CLI stores your token in a file only your user can read (<C>0600</C>).</li>
      </ul>

      <H2>Abuse protection</H2>
      <DocTable
        head={["Protection", "Details"]}
        rows={[
          ["Sign-in rate limits", "Strict per-IP limits on sign-in, sign-up, password reset and email verification"],
          ["API rate limits", "120 requests per minute per token"],
          ["App rate limits", "Limits on writes, reveals and exports per user"],
          ["Shared counters", "Limits are stored in the database, so they hold across all server instances"],
        ]}
      />

      <H2>Password Vault (zero-knowledge)</H2>
      <p>The vault is built so that the Veylix server can never read your passwords.</p>
      <ul>
        <li>Items are encrypted and decrypted <strong>in your browser</strong>. The server stores only ciphertext.</li>
        <li>
          Your <strong>master password is never sent or stored</strong>, not even as a hash. It&apos;s stretched with PBKDF2-SHA256 (600,000
          iterations) into a key that unlocks your private key.
        </li>
        <li>Sharing uses public-key cryptography (RSA-OAEP): a folder&apos;s key is sealed separately for each member.</li>
        <li>Unlocked keys live only in memory. Reloading the page or the auto-lock timer clears them.</li>
        <li>
          Breach checks use Have I Been Pwned&apos;s <strong>k-anonymity</strong> API: only the first 5 characters of a password&apos;s SHA-1 hash leave
          your browser.
        </li>
      </ul>
      <H3>What the server can see</H3>
      <p>
        To support search, the audit log and matching sites in the extension, folder names and each item&apos;s <strong>name, URL and tags</strong> are
        stored in plain text. Usernames, passwords and notes are always encrypted.
      </p>
      <Callout type="warning" title="Keep your recovery key">
        Because Veylix can&apos;t read your vault, it can&apos;t reset your master password for you. Store the recovery key you get at setup somewhere
        safe. Without it, a forgotten master password means resetting the vault.
      </Callout>

      <H2>Open source</H2>
      <p>
        Veylix is open source under the MIT license, so you can check exactly how all of this works in the <a href={GITHUB_URL}>source code</a>.
      </p>
    </>
  );
}
