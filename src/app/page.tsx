import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="font-mono text-4xl font-bold">envman</h1>
      <p className="max-w-md text-black/60 dark:text-white/60">
        Store your project&apos;s environment variables encrypted, per environment, and export them as a
        <code className="mx-1 rounded bg-black/5 px-1 dark:bg-white/10">.env</code>file anytime.
      </p>
      <div className="flex gap-3">
        <Link href="/sign-up" className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background">Get started</Link>
        <Link href="/sign-in" className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium dark:border-white/20">Sign in</Link>
      </div>
    </main>
  );
}
