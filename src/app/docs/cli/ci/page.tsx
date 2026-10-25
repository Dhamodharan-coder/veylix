import type { Metadata } from "next";
import Link from "next/link";
import { C, Callout, CodeBlock, DocHeader, H2 } from "../../components";

export const metadata: Metadata = {
  title: "CI/CD",
  description: "Use Veylix variables in GitHub Actions, GitLab CI, Docker and other pipelines with environment variables and npx.",
};

export default function CliCi() {
  return (
    <>
      <DocHeader eyebrow="CLI" title="CI/CD">
        In pipelines the CLI needs no login step and no prompts. Configure it entirely with environment variables.
      </DocHeader>

      <H2>The pattern</H2>
      <p>Store the token as a secret in your CI provider, set the project and environment, and run your command through <C>npx veylix-cli</C>:</p>
      <CodeBlock
        code={`VEYLIX_TOKEN=vlx_… VEYLIX_PROJECT=api VEYLIX_ENV=production \\
  npx veylix-cli run -- npm run deploy`}
      />
      <Callout type="tip" title="Use a dedicated CI token">
        Create a <strong>read-only</strong> token limited to <strong>one project</strong> (and ideally one environment) with an expiry. If it leaks,
        the damage is limited and it stops working on its own. See <Link href="/docs/tokens">API tokens</Link>.
      </Callout>

      <H2>GitHub Actions</H2>
      <p>
        Add the token under <strong>Repository → Settings → Secrets and variables → Actions</strong> as <C>VEYLIX_TOKEN</C>.
      </p>
      <CodeBlock
        title=".github/workflows/deploy.yml"
        code={`name: Deploy
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - name: Deploy with production variables
        env:
          VEYLIX_TOKEN: \${{ secrets.VEYLIX_TOKEN }}
          VEYLIX_PROJECT: api
          VEYLIX_ENV: production
        run: npx veylix-cli run -- npm run deploy`}
      />

      <H2>GitLab CI</H2>
      <p>
        Add <C>VEYLIX_TOKEN</C> under <strong>Settings → CI/CD → Variables</strong> and mark it <strong>Masked</strong>.
      </p>
      <CodeBlock
        title=".gitlab-ci.yml"
        code={`deploy:
  image: node:20
  variables:
    VEYLIX_PROJECT: api
    VEYLIX_ENV: production
  script:
    - npm ci
    - npx veylix-cli run -- npm run deploy`}
      />

      <H2>Docker</H2>
      <p>Write an env file at deploy time and pass it to the container. Don&apos;t bake secrets into images.</p>
      <CodeBlock
        title="Terminal"
        code={`veylix pull --env production --output .env.production
docker run --env-file .env.production my-image`}
      />
      <p>Or start the app through the CLI inside the container, with the token passed at runtime:</p>
      <CodeBlock
        title="Dockerfile"
        code={`FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm install -g veylix-cli
CMD ["veylix", "run", "--", "node", "server.js"]`}
      />
      <CodeBlock code="docker run -e VEYLIX_TOKEN=vlx_… -e VEYLIX_PROJECT=api -e VEYLIX_ENV=production my-image" />

      <H2>Without Node.js</H2>
      <p>
        If your pipeline has no Node.js, call the REST API directly. For example, to write a <C>.env</C> file with <C>curl</C>:
      </p>
      <CodeBlock
        code={`curl -fsS -H "Authorization: Bearer $VEYLIX_TOKEN" \\
  "https://veylix-omega.vercel.app/api/v1/secrets?project=api&env=production&format=dotenv" > .env`}
      />
      <p>
        See the <Link href="/docs/api/reference">endpoint reference</Link>.
      </p>
    </>
  );
}
