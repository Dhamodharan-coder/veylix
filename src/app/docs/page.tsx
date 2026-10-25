import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, KeyRound, ShieldCheck, Terminal, Workflow, Zap } from "lucide-react";
import { CardGrid, CodeBlock, DocHeader, H2 } from "./components";

export const metadata: Metadata = {
  title: { absolute: "Veylix Docs: CLI, REST API and API tokens" },
  description: "Veylix keeps your environment variables encrypted in one place and delivers them to apps, shells and CI/CD with a CLI and REST API.",
};

const cards = [
  { href: "/docs/quickstart", icon: Zap, title: "Quickstart", text: "From zero to `veylix run` in five minutes." },
  { href: "/docs/cli", icon: Terminal, title: "CLI", text: "Install, log in and link a folder to a project." },
  { href: "/docs/cli/ci", icon: Workflow, title: "CI/CD", text: "GitHub Actions, GitLab CI, Docker and more." },
  { href: "/docs/api", icon: BookOpen, title: "REST API", text: "Read and write variables over HTTPS." },
  { href: "/docs/tokens", icon: KeyRound, title: "API tokens", text: "Scopes, access levels, expiry and rotation." },
  { href: "/docs/security", icon: ShieldCheck, title: "Security", text: "How your data is encrypted and protected." },
];

export default function DocsHome() {
  return (
    <>
      <DocHeader eyebrow="Getting started" title="Veylix documentation">
        Veylix keeps your environment variables encrypted in one place and delivers them to local development, shells and CI/CD pipelines, so you
        never pass <code className="font-mono">.env</code> files around again.
      </DocHeader>

      <CodeBlock
        title="Terminal"
        code={`npm install -g veylix-cli
veylix login --token vlx_…
veylix link
veylix run -- npm run dev`}
      />

      <CardGrid>
        {cards.map(({ href, icon: Icon, title, text }) => (
          <Link key={href} href={href} className="group rounded-xl bg-card p-5 ring-1 ring-foreground/10 transition hover:ring-primary/40">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </div>
            <p className="mt-3 font-medium group-hover:text-primary">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </Link>
        ))}
      </CardGrid>

      <H2>How Veylix is organized</H2>
      <p>Your account holds <strong>projects</strong>. Each project has <strong>environments</strong> (new projects start with development, staging and production), and each environment holds <strong>variables</strong>: plain <code className="font-mono">KEY=value</code> pairs, encrypted at rest with AES-256-GCM.</p>
      <CodeBlock
        code={`my-account
├── api                    ← project
│   ├── development        ← environment
│   │   ├── DATABASE_URL   ← variable
│   │   └── STRIPE_KEY
│   ├── staging
│   └── production
└── web
    ├── development
    └── production`}
      />

      <H2>Ways to use your variables</H2>
      <ul>
        <li><strong>Web app:</strong> create projects, edit variables, import and export <code className="font-mono">.env</code> files, and compare environments.</li>
        <li><strong>CLI (<code className="font-mono">veylix</code>):</strong> inject variables into any command, write <code className="font-mono">.env</code> files, push changes from your terminal.</li>
        <li><strong>REST API:</strong> read and write variables from any language or platform with a bearer token.</li>
      </ul>
      <p>
        The CLI and API authenticate with <Link href="/docs/tokens">API tokens</Link> that you create under <strong>Settings → API tokens</strong>. A token can
        reach all of your projects or just one, and can be read-only.
      </p>

      <H2>Compare environments</H2>
      <p>
        A variable added to development but forgotten in production is a classic cause of failed deploys. On a project page, click{" "}
        <strong>Compare</strong> next to the environment tabs and pick two environments:
      </p>
      <ul>
        <li><strong>Missing:</strong> the key exists in only one of them. Click <strong>Copy</strong> to add it to the other (existing keys are never overwritten).</li>
        <li><strong>Different:</strong> both have the key with different values, which is normal for things like database URLs.</li>
        <li><strong>Same value:</strong> identical in both. Worth a look if it&apos;s something like a test API key in production.</li>
      </ul>
      <p>
        Values are compared on the server and never sent to your browser. From the terminal, <Link href="/docs/cli/commands#diff">veylix diff</Link>{" "}
        shows the same comparison and can fail a CI job when keys are missing.
      </p>

      <H2>Password Vault</H2>
      <p>
        Veylix also includes a zero-knowledge password vault with sharing, security reports and a browser extension. The vault is a separate module with
        its own encryption and isn&apos;t reachable through the CLI or REST API. See <Link href="/docs/security">Security</Link> for how it works.
      </p>
    </>
  );
}
