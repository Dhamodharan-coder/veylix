import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle";
import { buttonVariants } from "@/components/ui/button";
import { DocsPager, DocsSidebar, MobileDocsNav } from "./sidebar";
import { TableOfContents } from "./toc";
import { GITHUB_URL, NPM_URL } from "./nav";

export const metadata: Metadata = {
  title: { template: "%s · Veylix Docs", default: "Veylix Docs" },
  description: "Documentation for the Veylix CLI, REST API and API tokens: pull environment variables into apps, shells and CI/CD pipelines.",
};

export default function DocsLayout({ children }: LayoutProps<"/docs">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-8">
          <Logo href="/" />
          <Link href="/docs" className="ml-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            Docs
          </Link>
          <div className="ml-auto flex items-center gap-1">
            <a href={NPM_URL} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", className: "hidden sm:inline-flex" })}>
              npm
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "ghost", className: "hidden sm:inline-flex" })}>
              GitHub
            </a>
            <ModeToggle />
            <Link href="/dashboard" className={buttonVariants({ className: "ml-1" })}>
              Open app
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl gap-10 px-4 sm:px-8">
        <DocsSidebar />
        <main className="min-w-0 flex-1 py-8 lg:py-10">
          <div className="mb-4 lg:hidden">
            <MobileDocsNav />
          </div>
          <article id="docs-content" className="docs-content mx-auto max-w-3xl">
            {children}
            <DocsPager />
          </article>
        </main>
        <TableOfContents />
      </div>
    </div>
  );
}
