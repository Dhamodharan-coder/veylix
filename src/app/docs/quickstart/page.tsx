import type { Metadata } from "next";
import Link from "next/link";
import { C, Callout, CodeBlock, DocHeader, H2 } from "../components";
import { SITE_URL } from "../nav";

export const metadata: Metadata = {
  title: "Quickstart",
  description: "Create a project, make an API token and run your app with Veylix variables in five minutes.",
};

export default function Quickstart() {
  return (
    <>
      <DocHeader eyebrow="Getting started" title="Quickstart">
        Go from an empty account to running your app with Veylix variables in about five minutes.
      </DocHeader>

      <H2 id="create-a-project">1. Create a project</H2>
      <p>
        Sign in at <a href={SITE_URL}>{SITE_URL.replace("https://", "")}</a>, click <strong>New project</strong> and give it a name such as{" "}
        <C>api</C>. It comes with <C>development</C>, <C>staging</C> and <C>production</C> environments.
      </p>
      <p>
        Add a few variables with <strong>Add variable</strong>, or click <strong>Import</strong> and paste (or drop) an existing <C>.env</C> file.
      </p>

      <H2 id="create-a-token">2. Create an API token</H2>
      <p>
        Go to <strong>Settings → API tokens → Create token</strong>. Keep the defaults (all projects, read only, expires in 90 days) and copy the token.
        It starts with <C>vlx_</C>.
      </p>
      <Callout type="warning" title="Treat tokens like passwords">
        Anyone with the token can read your variables. Never commit it to git. You can copy it again later from <strong>View</strong>, or{" "}
        <strong>Regenerate</strong> it if it leaks.
      </Callout>

      <H2 id="install-the-cli">3. Install the CLI and log in</H2>
      <p>You need Node.js 18 or newer.</p>
      <CodeBlock
        title="Terminal"
        code={`npm install -g veylix-cli
veylix login --token vlx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}
      />
      <CodeBlock
        title="Output"
        code={`✓ Logged in to ${SITE_URL} as you@company.com: all projects (1), read
Next: run veylix link in your app's folder to choose a project and environment.`}
      />

      <H2 id="link-a-folder">4. Link your app&apos;s folder</H2>
      <CodeBlock
        title="Terminal"
        code={`cd my-app
veylix link`}
      />
      <p>
        Pick the project and environment. Veylix saves your choice in <C>.veylix.json</C>. It contains no secrets, so commit it and your whole team
        uses the same environment.
      </p>

      <H2 id="run-your-app">5. Run your app</H2>
      <CodeBlock
        title="Terminal"
        code={`veylix run -- npm run dev      # inject variables, nothing written to disk
veylix pull > .env              # or write a .env file`}
      />
      <Callout type="tip" title="That's it">
        Your app now reads its variables from Veylix. Change a value in the web app and the next <C>veylix run</C> picks it up.
      </Callout>

      <H2 id="next-steps">Next steps</H2>
      <ul>
        <li><Link href="/docs/cli/commands">All CLI commands</Link>, including <C>push</C>, <C>set</C> and output formats</li>
        <li><Link href="/docs/cli/ci">Use Veylix in CI/CD</Link> with GitHub Actions, GitLab or Docker</li>
        <li><Link href="/docs/api/reference">Call the REST API</Link> from your own code</li>
      </ul>
    </>
  );
}
