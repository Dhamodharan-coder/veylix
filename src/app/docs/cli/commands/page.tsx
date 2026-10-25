import type { Metadata } from "next";
import Link from "next/link";
import { C, Callout, CodeBlock, DocHeader, DocTable, H2, H3 } from "../../components";

export const metadata: Metadata = {
  title: "CLI commands",
  description: "Reference for every veylix command: login, link, pull, run, push, set, unset, whoami, projects and envs.",
};

export default function CliCommands() {
  return (
    <>
      <DocHeader eyebrow="CLI" title="Commands">
        Every command, its options and example output. All commands accept <C>--project</C> and <C>--env</C> to override the folder link.
      </DocHeader>

      <DocTable
        head={["Command", "What it does"]}
        rows={[
          [<C key="c">pull</C>, "Print or save variables (dotenv, JSON or shell)"],
          [<C key="c">run</C>, "Run a command with variables injected"],
          [<C key="c">push</C>, "Upload a .env file"],
          [<C key="c">set</C>, "Create or update variables"],
          [<C key="c">unset</C>, "Delete a variable"],
          [<C key="c">link / unlink</C>, "Choose the project and environment for a folder"],
          [<C key="c">projects</C>, "List projects, environments and variable counts"],
          [<C key="c">envs</C>, "List the environments of the current project"],
          [<C key="c">whoami</C>, "Show account, server, token access and linked project"],
          [<C key="c">login / logout</C>, "Save or remove your token"],
          [<C key="c">help, --version</C>, "Show help or the version"],
        ]}
      />

      <H2>pull</H2>
      <p>Prints the environment&apos;s variables to stdout, or writes them to a file.</p>
      <CodeBlock code="veylix pull [--format dotenv|json|shell] [--output <file>]" />
      <DocTable
        head={["Option", "Description"]}
        rows={[
          [<C key="o">--format dotenv</C>, <>Default. <C>KEY=&quot;value&quot;</C> lines, values JSON-quoted so newlines and quotes survive.</>],
          [<C key="o">--format json</C>, "A JSON object of key → value."],
          [<C key="o">--format shell</C>, <><C>export KEY=&apos;value&apos;</C> lines for <C>eval</C>.</>],
          [<C key="o">--output &lt;file&gt;</C>, <>Write to a file with <C>0600</C> permissions instead of stdout.</>],
        ]}
      />
      <CodeBlock
        title="Examples"
        code={`veylix pull > .env
veylix pull --output .env.local
veylix pull --project api --env production --format json
eval "$(veylix pull --format shell)"     # load into the current shell`}
      />
      <Callout type="warning">
        Files written by <C>pull</C> contain real secrets. Add <C>.env*</C> to your <C>.gitignore</C>.
      </Callout>

      <H2>run</H2>
      <p>
        Starts a command with the variables added to its environment. Nothing is written to disk. Everything after <C>--</C> is the command.
      </p>
      <CodeBlock code="veylix run [--project <name>] [--env <name>] -- <command> [args…]" />
      <CodeBlock
        title="Examples"
        code={`veylix run -- npm run dev
veylix run --env staging -- node server.js
veylix run -- python manage.py migrate`}
      />
      <ul>
        <li>Veylix variables override variables of the same name already in your shell.</li>
        <li>Ctrl+C and other signals are passed to the child process.</li>
        <li>The CLI exits with the command&apos;s exit code, so it works in scripts and CI.</li>
      </ul>

      <H2>push</H2>
      <p>
        Uploads a <C>.env</C> file. Needs a <strong>read &amp; write</strong> token.
      </p>
      <CodeBlock code="veylix push [--file .env] [--replace]" />
      <DocTable
        head={["Option", "Description"]}
        rows={[
          [<C key="o">--file</C>, <>File to upload. Default <C>.env</C>.</>],
          [<C key="o">--replace</C>, "Make the environment match the file exactly: keys not in the file are deleted."],
        ]}
      />
      <CodeBlock
        title="Example"
        code={`$ veylix push --file .env.production --env production
✓ api › production: 3 created, 9 updated`}
      />
      <p>
        Comments, blank lines and <C>export</C> prefixes are ignored. Single- and double-quoted values are supported.
      </p>

      <H2>set and unset</H2>
      <p>Change individual variables. Needs a read &amp; write token.</p>
      <CodeBlock
        title="Examples"
        code={`$ veylix set STRIPE_KEY=sk_live_… FEATURE_FLAG=true
✓ api › development: 1 created, 1 updated

$ veylix unset LEGACY_API_URL
✓ Deleted LEGACY_API_URL from api › development`}
      />
      <p>Keys may contain letters, digits and underscores, and can&apos;t start with a digit.</p>

      <H2>link and unlink</H2>
      <CodeBlock code={`veylix link [--project <name>] [--env <name>]
veylix unlink`} />
      <p>
        Without flags, <C>link</C> asks which project and environment to use. It writes <C>.veylix.json</C> in the current folder. See{" "}
        <Link href="/docs/cli#link-a-folder">Link a folder</Link>.
      </p>

      <H2>projects and envs</H2>
      <CodeBlock
        title="Examples"
        code={`$ veylix projects
PROJECT  ENVIRONMENTS (variables)
api      development* (12), staging (14), production (14)
web      development (8), production (8)

* currently used in this folder

$ veylix envs
api
ENVIRONMENT  VARIABLES
development  12
staging      14
production   14`}
      />

      <H2>whoami</H2>
      <p>Shows the account, server, token access and what this folder uses. Good for checking your setup.</p>

      <H2>login and logout</H2>
      <CodeBlock code={`veylix login --token <vlx_…> [--url <server>]
veylix logout`} />
      <p>
        <C>login</C> verifies the token before saving it. <C>logout</C> removes the token but remembers the server URL.
      </p>

      <H3>Exit codes</H3>
      <p>
        Commands exit with <C>0</C> on success and <C>1</C> on any error, with the message on stderr. <C>run</C> exits with the child command&apos;s code.
      </p>
    </>
  );
}
