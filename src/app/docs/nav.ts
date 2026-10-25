export type DocPage = { title: string; href: string; keywords?: string };
export type DocSection = { title: string; pages: DocPage[] };

export const SITE_URL = "https://veylix-omega.vercel.app";
export const NPM_URL = "https://www.npmjs.com/package/veylix-cli";
export const GITHUB_URL = "https://github.com/Dhamodharan-coder/veylix";

/** Sidebar order; also drives search and the previous/next links. */
export const DOCS_NAV: DocSection[] = [
  {
    title: "Getting started",
    pages: [
      { title: "Introduction", href: "/docs", keywords: "overview env manager vault what is veylix" },
      { title: "Quickstart", href: "/docs/quickstart", keywords: "first project token install five minutes" },
    ],
  },
  {
    title: "CLI",
    pages: [
      { title: "Installation & setup", href: "/docs/cli", keywords: "npm install login link config veylix.json VEYLIX_TOKEN VEYLIX_URL self-hosted" },
      { title: "Commands", href: "/docs/cli/commands", keywords: "pull run push set unset whoami projects envs link unlink logout format output replace" },
      { title: "CI/CD", href: "/docs/cli/ci", keywords: "github actions gitlab docker vercel pipeline npx" },
    ],
  },
  {
    title: "REST API",
    pages: [
      { title: "Overview", href: "/docs/api", keywords: "base url bearer authentication errors status codes rate limits 401 403 404 429" },
      { title: "Endpoint reference", href: "/docs/api/reference", keywords: "GET PUT DELETE /api/v1/me /api/v1/secrets curl fetch dotenv json replace" },
    ],
  },
  {
    title: "Guides",
    pages: [
      { title: "API tokens", href: "/docs/tokens", keywords: "create scope read write expiry regenerate revoke rotate" },
      { title: "Security", href: "/docs/security", keywords: "encryption aes-256 zero-knowledge vault hash sha-256 data" },
    ],
  },
];

export const DOCS_PAGES = DOCS_NAV.flatMap((s) => s.pages);
