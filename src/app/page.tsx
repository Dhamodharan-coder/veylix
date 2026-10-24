import Link from "next/link";
import { ArrowRight, Layers, LockKeyhole, Share2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";

const features = [
  { icon: LockKeyhole, title: "Encrypted at rest", text: "Values are sealed with AES-256-GCM before they're stored. Only you can reveal them." },
  { icon: Layers, title: "Every environment", text: "Development, staging, production, or your own. Each one keeps its own variables." },
  { icon: Share2, title: "Works with .env", text: "Import an existing file in seconds and export a ready-to-use file anytime." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <Logo href="/" />
          <div className="flex items-center gap-2">
            <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>Sign in</Link>
            <Link href="/sign-up" className={buttonVariants()}>Get started</Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 pt-20 pb-16 text-center sm:px-8 sm:pt-28">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 ring-1 ring-foreground/10 py-1 text-xs font-medium text-muted-foreground shadow-xs">
            <ShieldCheck size={14} className="text-success" /> End-to-end encrypted storage
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Environment variables, <span className="text-primary">managed properly.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
            Store your project&apos;s configuration encrypted, organize it per environment, and stop pasting secrets into chat.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link href="/sign-up" className={buttonVariants({ size: "lg", className: "h-10 px-5" })}>
              Create free account <ArrowRight size={16} />
            </Link>
            <Link href="/sign-in" className={buttonVariants({ variant: "outline", size: "lg", className: "h-10 px-5" })}>Sign in</Link>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 pb-24 sm:grid-cols-3 sm:px-8">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl bg-card p-6 shadow-xs ring-1 ring-foreground/10">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon size={18} />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1.5 text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
