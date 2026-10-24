import { Suspense } from "react";
import { requireUser } from "@/lib/session";
import { PageHeader } from "@/components/page";
import { ProfileSkeleton } from "@/components/skeletons";
import { ProfileForm } from "./profile-form";
import { AppearanceSettings } from "./appearance";

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your account and preferences." />
      <div className="flex max-w-3xl flex-col gap-6">
        <Suspense fallback={<ProfileSkeleton />}>
          <Profile />
        </Suspense>
        <AppearanceSettings />
      </div>
    </>
  );
}

async function Profile() {
  const user = await requireUser();
  return <ProfileForm name={user.name} email={user.email} />;
}
