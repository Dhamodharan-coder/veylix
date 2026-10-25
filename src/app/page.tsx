import Link from "next/link";
import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";

const features = [
  { icon: KeyRound, title: "Env Manager", text: "Projects, environments and variables, encrypted at rest. Import and export .env files anytime." },
  { icon: ShieldCheck, title: "Password Vault", text: "Save logins in folders, generate strong passwords and share them with your team." },
  { icon: LockKeyhole, title: "Zero-knowledge encryption", text: "Vault items are encrypted in your browser with your master password. Only you can read them." },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-8">
          <Logo href="/" />
          <div className="flex items-center gap-2">
            <Link href="/docs" className={buttonVariants({ variant: "ghost" })}>Docs</Link>
            <Link href="/sign-in"className={buttonVariants({ variant: "ghost" })}>Sign in</Link>
            <Link href="/sign-up" className={buttonVariants()}>Get started</Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 pt-20 pb-16 text-center sm:px-8 sm:pt-28">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 ring-1 ring-foreground/10 py-1 text-xs font-medium text-muted-foreground shadow-xs">
            <ShieldCheck size={14} className="text-success" /> Env Manager + Password Vault
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Secrets and passwords, <span className="text-primary">under control.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
            Veylix combines an environment variable manager and a zero-knowledge password vault for your whole team.
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
