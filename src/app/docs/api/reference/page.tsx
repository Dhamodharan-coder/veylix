import type { Metadata } from "next";
import { C, Callout, CodeBlock, DocHeader, DocTable, Endpoint, H2, H3 } from "../../components";
import { SITE_URL } from "../../nav";

export const metadata: Metadata = {
  title: "API endpoint reference",
  description: "GET /api/v1/me and GET, PUT, DELETE /api/v1/secrets: parameters, request bodies and example responses.",
};

const BASE = `${SITE_URL}/api/v1`;

export default function ApiReference() {
  return (
    <>
      <DocHeader eyebrow="REST API" title="Endpoint reference">
        All endpoints live under <C>{BASE}</C> and require <C>Authorization: Bearer vlx_…</C>.
      </DocHeader>

      <H2 id="get-me">Get token info</H2>
      <Endpoint method="GET" path="/api/v1/me" />
      <p>Returns the token&apos;s owner, access level, and every project and environment it can reach, with variable counts.</p>
      <CodeBlock title="Request" code={`curl -H "Authorization: Bearer $VEYLIX_TOKEN" ${BASE}/me`} />
      <CodeBlock
        title="Response 200"
        code={`{
  "user": { "name": "Ada Lovelace", "email": "ada@company.com" },
  "access": "read",                 // "read" | "read-write"
  "scope": "all-projects",          // "all-projects" | "project"
  "projects": [
    {
      "id": "cmh2x…",
      "name": "api",
      "environments": [
        { "name": "development", "variables": 12 },
        { "name": "production", "variables": 14 }
      ]
    }
  ]
}`}
      />

      <H2 id="get-secrets">Get variables</H2>
      <Endpoint method="GET" path="/api/v1/secrets?project={project}&env={env}" />
      <p>Returns all variables of one environment, decrypted.</p>
      <DocTable
        head={["Query parameter", "Description"]}
        rows={[
          [<C key="p">project</C>, "Project name or ID. Optional if the token reaches one project."],
          [<C key="p">env</C>, "Environment name. Optional if the project has one environment."],
          [<C key="p">format</C>, <>Optional. <C key="c">dotenv</C> returns plain-text <C key="d">.env</C> content instead of JSON.</>],
        ]}
      />
      <H3>JSON (default)</H3>
      <CodeBlock title="Request" code={`curl -H "Authorization: Bearer $VEYLIX_TOKEN" \\
  "${BASE}/secrets?project=api&env=production"`} />
      <CodeBlock
        title="Response 200"
        code={`{
  "project": "api",
  "environment": "production",
  "secrets": {
    "DATABASE_URL": "postgres://…",
    "STRIPE_KEY": "sk_live_…"
  }
}`}
      />
      <H3>dotenv</H3>
      <CodeBlock title="Request" code={`curl -H "Authorization: Bearer $VEYLIX_TOKEN" \\
  "${BASE}/secrets?project=api&env=production&format=dotenv" > .env`} />
      <CodeBlock
        title="Response 200 (text/plain)"
        code={`DATABASE_URL="postgres://…"
STRIPE_KEY="sk_live_…"`}
      />
      <H3>JavaScript</H3>
      <CodeBlock
        title="load-env.js"
        code={`const res = await fetch("${BASE}/secrets?project=api&env=production", {
  headers: { Authorization: \`Bearer \${process.env.VEYLIX_TOKEN}\` },
});
if (!res.ok) throw new Error((await res.json()).error);
const { secrets } = await res.json();
Object.assign(process.env, secrets);`}
      />

      <H2 id="put-secrets">Create or update variables</H2>
      <Endpoint method="PUT" path="/api/v1/secrets" />
      <p>
        Creates new keys and updates existing ones in one environment, in a single transaction. Requires a <strong>read &amp; write</strong> token.
      </p>
      <DocTable
        head={["Body field", "Type", "Description"]}
        rows={[
          [<C key="f">project</C>, "string", "Project name or ID. Optional if the token reaches one project."],
          [<C key="f">env</C>, "string", "Environment name. Optional if the project has one environment."],
          [<C key="f">secrets</C>, "object", "Key → value strings. Up to 1,000 keys; values up to 100,000 characters."],
          [<C key="f">replace</C>, "boolean", <>Optional. <C key="c">true</C> deletes keys that aren&apos;t in <C key="s">secrets</C>, so the environment matches exactly.</>],
        ]}
      />
      <CodeBlock
        title="Request"
        code={`curl -X PUT ${BASE}/secrets \\
  -H "Authorization: Bearer $VEYLIX_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "project": "api",
    "env": "staging",
    "secrets": { "FEATURE_FLAG": "true", "API_URL": "https://staging.example.com" }
  }'`}
      />
      <CodeBlock
        title="Response 200"
        code={`{ "project": "api", "environment": "staging", "created": 1, "updated": 1, "deleted": 0 }`}
      />
      <Callout type="warning" title="replace: true deletes data">
        With <C>replace</C>, any key missing from your request is permanently deleted from the environment.
      </Callout>

      <H2 id="delete-secret">Delete a variable</H2>
      <Endpoint method="DELETE" path="/api/v1/secrets?project={project}&env={env}&key={KEY}" />
      <p>Deletes one variable. Requires a read &amp; write token. Returns 404 if the key doesn&apos;t exist.</p>
      <CodeBlock
        title="Request"
        code={`curl -X DELETE -H "Authorization: Bearer $VEYLIX_TOKEN" \\
  "${BASE}/secrets?project=api&env=staging&key=FEATURE_FLAG"`}
      />
      <CodeBlock title="Response 200" code={`{ "project": "api", "environment": "staging", "deleted": "FEATURE_FLAG" }`} />

      <H2 id="key-rules">Key rules</H2>
      <p>
        Keys may contain letters, digits and underscores, and can&apos;t start with a digit (<C>DATABASE_URL</C>, <C>_PRIVATE</C>, <C>API_V2</C>). Values
        are any string.
      </p>
    </>
  );
}
