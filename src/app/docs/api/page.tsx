import type { Metadata } from "next";
import Link from "next/link";
import { C, Callout, CodeBlock, DocHeader, DocTable, H2 } from "../components";
import { SITE_URL } from "../nav";

export const metadata: Metadata = {
  title: "REST API overview",
  description: "Base URL, bearer token authentication, project and environment targeting, errors and rate limits for the Veylix REST API.",
};

export default function ApiOverview() {
  return (
    <>
      <DocHeader eyebrow="REST API" title="Overview">
        Read and write environment variables over HTTPS from any language. The CLI uses this same API.
      </DocHeader>

      <H2>Base URL</H2>
      <CodeBlock code={`${SITE_URL}/api/v1`} />
      <p>For a self-hosted instance, use your own domain with the same path.</p>

      <H2>Authentication</H2>
      <p>
        Send an <Link href="/docs/tokens">API token</Link> in the <C>Authorization</C> header of every request:
      </p>
      <CodeBlock code="Authorization: Bearer vlx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
      <CodeBlock
        title="Try it"
        code={`curl -H "Authorization: Bearer $VEYLIX_TOKEN" ${SITE_URL}/api/v1/me`}
      />
      <p>
        <strong>Read</strong> tokens can call <C>GET</C> endpoints. <strong>Read &amp; write</strong> tokens can also call <C>PUT</C> and{" "}
        <C>DELETE</C>.
      </p>
      <Callout type="warning">
        Only call the API from servers, CI or scripts. Never put a token in browser or mobile app code, where anyone can extract it.
      </Callout>

      <H2>Choosing the project and environment</H2>
      <p>
        Endpoints that work with variables take a <C>project</C> and an <C>env</C>, as query parameters (<C>GET</C>, <C>DELETE</C>) or body fields
        (<C>PUT</C>):
      </p>
      <ul>
        <li>
          <C>project</C> is a project <strong>name</strong> (case-insensitive) or <strong>ID</strong>. It can be omitted when the token reaches exactly
          one project.
        </li>
        <li>
          <C>env</C> is an environment name, e.g. <C>production</C>. It can be omitted when the project has exactly one environment (or the token is
          limited to one).
        </li>
      </ul>
      <p>
        Call <C>GET /me</C> to list what a token can reach.
      </p>

      <H2>Errors</H2>
      <p>Errors return a non-2xx status and a JSON body with a readable message:</p>
      <CodeBlock code={`{ "error": "Environment \\"prod\\" not found in api or not allowed for this token" }`} />
      <DocTable
        head={["Status", "Meaning", "What to do"]}
        rows={[
          [<C key="s">400</C>, "Bad request: invalid body or key, or the project/environment is ambiguous", "Read the message; pass project and env"],
          [<C key="s">401</C>, "Missing, invalid, revoked or expired token", "Check the header; create a new token"],
          [<C key="s">403</C>, "The token is read-only", "Use a read & write token for PUT / DELETE"],
          [<C key="s">404</C>, "Project, environment or key not found, or outside the token's scope", <>Call <C key="c">GET /me</C> to see what&apos;s reachable</>],
          [<C key="s">429</C>, "Rate limit exceeded", <>Wait for <C key="c">Retry-After</C> seconds, then retry</>],
        ]}
      />

      <H2>Rate limits</H2>
      <p>
        Each token may make <strong>120 requests per minute</strong>. Beyond that the API responds with <C>429 Too Many Requests</C> and a{" "}
        <C>Retry-After</C> header saying how many seconds to wait. Fetch variables once at startup rather than per request.
      </p>

      <H2>Caching</H2>
      <p>
        Responses that contain variables are sent with <C>Cache-Control: no-store</C>, so proxies and browsers never cache secrets.
      </p>

      <p>
        Next: the <Link href="/docs/api/reference">endpoint reference</Link>.
      </p>
    </>
  );
}
