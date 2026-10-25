import type { Metadata } from "next";
import { C, Callout, DocHeader, DocTable, H2 } from "../components";

export const metadata: Metadata = {
  title: "API tokens",
  description: "Create, scope, expire, copy, regenerate and revoke Veylix API tokens for the CLI, CI and REST API.",
};

export default function ApiTokens() {
  return (
    <>
      <DocHeader eyebrow="Guides" title="API tokens">
        Tokens let the CLI, CI pipelines and your own code access your variables without your password.
      </DocHeader>

      <H2>Create a token</H2>
      <ol>
        <li>Sign in and open <strong>Settings → API tokens</strong>.</li>
        <li>Click <strong>Create token</strong> and choose a name, scope, access and expiry.</li>
        <li>Copy the token. It looks like <C>vlx_</C> followed by 43 characters.</li>
      </ol>

      <H2>Options</H2>
      <DocTable
        head={["Option", "Choices", "Notes"]}
        rows={[
          ["Name", "Any label", <>For you, e.g. <C key="c">laptop</C> or <C key="c2">github-actions-api</C>.</>],
          ["Project", "All projects (default) or one project", "All projects: pick the project per folder with veylix link. One project: the token can't see anything else."],
          ["Environment", "All environments or one", "Only when limited to one project. Great for production-only CI tokens."],
          ["Access", "Read only (default) · Read & write", "Read: pull, run, GET. Read & write: also push, set, unset, PUT, DELETE."],
          ["Expires", "30 days · 90 days (default) · 1 year · Never", "Expired tokens get 401 errors."],
        ]}
      />

      <H2>Recommended setups</H2>
      <DocTable
        head={["Use", "Scope", "Access", "Expiry"]}
        rows={[
          ["Your laptop", "All projects", "Read & write", "1 year"],
          ["CI deploy to production", "One project, production only", "Read only", "90 days"],
          ["Script that syncs variables", "One project", "Read & write", "90 days"],
        ]}
      />

      <H2>Manage tokens</H2>
      <ul>
        <li><strong>View:</strong> copy a token again at any time, with ready-to-paste CLI commands.</li>
        <li><strong>Regenerate:</strong> issues a new value with the same settings. The old value stops working immediately. Use it to rotate a token or after a leak.</li>
        <li><strong>Revoke:</strong> deletes the token. Anything using it loses access immediately.</li>
        <li>The list shows when each token was <strong>last used</strong>, so you can spot and remove unused ones.</li>
      </ul>
      <p>
        Deleting a project also deletes tokens limited to it. A token only ever reaches projects its creator owns.
      </p>

      <Callout type="warning" title="If a token leaks">
        Click <strong>Regenerate</strong> (or <strong>Revoke</strong>) right away, then update the new value wherever it&apos;s used. If it had read
        access, also rotate the secrets it could read, such as database passwords and API keys.
      </Callout>

      <H2>Good practices</H2>
      <ul>
        <li>One token per machine or pipeline, so you can revoke one without breaking the others.</li>
        <li>Prefer read-only tokens. Most uses only need <C>pull</C> or <C>run</C>.</li>
        <li>Set an expiry, and store CI tokens in your provider&apos;s secret store, never in the repository.</li>
      </ul>
    </>
  );
}
