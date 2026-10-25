import type { Metadata } from "next";
import Link from "next/link";
import { C, Callout, CodeBlock, DocHeader, DocTable, H2, H3 } from "../components";
import { NPM_URL, SITE_URL } from "../nav";

export const metadata: Metadata = {
  title: "CLI installation & setup",
  description: "Install the veylix CLI, log in with an API token, link folders to projects and configure it with flags or environment variables.",
};

export default function CliSetup() {
  return (
    <>
      <DocHeader eyebrow="CLI" title="Installation & setup">
        <C>veylix</C> is a single-file, zero-dependency command-line tool for Node.js 18+. It pulls variables into your apps, shells and pipelines.
      </DocHeader>

      <H2>Install</H2>
      <CodeBlock
        title="Terminal"
        code={`npm install -g veylix-cli      # or: pnpm add -g veylix-cli / yarn global add veylix-cli
veylix --version`}
      />
      <p>To run it once without installing (handy in CI):</p>
      <CodeBlock code="npx veylix-cli pull" />
      <p>
        The package is published on <a href={NPM_URL}>npm as veylix-cli</a>. Update with <C>npm install -g veylix-cli@latest</C>.
      </p>
      <Callout title="Using nvm?">
        Global packages belong to one Node version. After <C>nvm use</C> switches versions, install the CLI again.
      </Callout>

      <H2>Log in</H2>
      <p>
        Create a token under <strong>Settings → API tokens</strong> (see <Link href="/docs/tokens">API tokens</Link>), then:
      </p>
      <CodeBlock code="veylix login --token vlx_…" />
      <p>
        The CLI checks the token against the server and saves it to <C>~/.config/veylix/config.json</C> with <C>0600</C> permissions (only your user can
        read it). It respects <C>XDG_CONFIG_HOME</C>. <C>veylix logout</C> removes the token.
      </p>

      <H3>Self-hosted Veylix</H3>
      <p>
        The CLI talks to <C>{SITE_URL}</C> by default. For your own server, pass <C>--url</C> once at login and it&apos;s remembered:
      </p>
      <CodeBlock code="veylix login --url https://veylix.your-company.com --token vlx_…" />

      <H2>Link a folder</H2>
      <p>Tell the CLI which project and environment a folder uses:</p>
      <CodeBlock
        title="Terminal"
        code={`veylix link                                   # choose interactively
veylix link --project api --env development   # or non-interactively`}
      />
      <p>This writes <C>.veylix.json</C> to the current folder:</p>
      <CodeBlock
        title=".veylix.json"
        code={`{
  "projectId": "cmh2x…",
  "project": "api",
  "env": "development"
}`}
      />
      <ul>
        <li>It holds no secrets. <strong>Commit it</strong> so everyone on the team pulls the same environment.</li>
        <li>The CLI looks for it in the current folder and every parent folder, so one link at the root of a monorepo covers all packages.</li>
        <li>The project is matched by ID first, so renaming the project in Veylix doesn&apos;t break the link.</li>
        <li><C>veylix unlink</C> removes it.</li>
      </ul>

      <H2>Configuration</H2>
      <p>Every setting can come from a flag, an environment variable or a saved file. The first match wins:</p>
      <DocTable
        head={["Setting", "1. Flag", "2. Environment variable", "3. Saved"]}
        rows={[
          ["Token", <C key="f">--token</C>, <C key="e">VEYLIX_TOKEN</C>, <C key="s">~/.config/veylix/config.json</C>],
          ["Server URL", <C key="f">--url</C>, <C key="e">VEYLIX_URL</C>, <span key="s"><C>config.json</C>, then <C>{SITE_URL}</C></span>],
          ["Project", <C key="f">--project</C>, <C key="e">VEYLIX_PROJECT</C>, <C key="s">.veylix.json</C>],
          ["Environment", <C key="f">--env</C>, <C key="e">VEYLIX_ENV</C>, <C key="s">.veylix.json</C>],
        ]}
      />
      <p>
        <C>--project</C> accepts a project name (case-insensitive) or ID. You can leave out the project when the token reaches only one, and the
        environment when the project has only one.
      </p>
      <Callout type="tip" title="One-off overrides">
        Any command accepts <C>--project</C> and <C>--env</C>, e.g. <C>veylix run --env staging -- npm start</C>, without changing the folder link.
      </Callout>

      <H2>Check your setup</H2>
      <CodeBlock
        title="Terminal"
        code={`$ veylix whoami
Account:  Ada Lovelace <ada@company.com>
Server:   ${SITE_URL}
Token:    all projects, read
Using:    api › development
Linked:   .veylix.json`}
      />
      <p>
        Next: <Link href="/docs/cli/commands">all commands</Link>.
      </p>
    </>
  );
}
