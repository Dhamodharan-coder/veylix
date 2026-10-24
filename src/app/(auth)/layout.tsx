import { KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";

const features = [
  { icon: KeyRound, title: "Env Manager", text: "Keep variables for development, staging and production organized and encrypted." },
  { icon: ShieldCheck, title: "Password Vault", text: "Store and share logins with your team, unlocked by your master password." },
  { icon: LockKeyhole, title: "Zero-knowledge", text: "Vault data is encrypted in your browser. Not even our servers can read it." },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="grid flex-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden flex-col overflow-hidden bg-[#0f3b8c] p-10 text-white lg:flex">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(80,140,255,0.55),transparent_45%),radial-gradient(circle_at_90%_90%,rgba(29,106,229,0.6),transparent_50%)]" />
        <div className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative">
          <Logo href="/" inverted />
        </div>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-3xl leading-tight font-semibold tracking-tight">Your team&apos;s secrets and passwords, in one secure place.</h2>
          <p className="mt-3 text-white/70">Veylix brings environment variables and a password vault together, so nothing sensitive lives in chat or spreadsheets again.</p>
          <ul className="mt-8 flex flex-col gap-5">
            {features.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon size={17} />
                </span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="block text-[13px] text-white/65">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-xs text-white/50">© {2026} Veylix</p>
      </aside>

      <main className="flex flex-col items-center justify-center bg-background px-4 py-10 sm:px-6">
        <div className="mb-10 lg:hidden">
          <Logo href="/" />
        </div>
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
