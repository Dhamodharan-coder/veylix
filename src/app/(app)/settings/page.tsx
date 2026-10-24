import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/session";
import { ProfileForm } from "./profile-form";
import { ProfileSkeleton } from "@/components/skeleton";

export default function SettingsPage() {
  return (
    <>
      <h1 className="mb-8 text-2xl font-semibold">Settings</h1>
      <div className="flex flex-col gap-10">
        <Section title="Profile" description="How your name appears in envman.">
          <Suspense fallback={<ProfileSkeleton />}>
            <Profile />
          </Suspense>
        </Section>
      </div>
    </>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mb-4 text-sm opacity-60">{description}</p>
      {children}
    </section>
  );
}

async function Profile() {
  const user = await requireUser();
  return <ProfileForm name={user.name} email={user.email} />;
}
