"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, UserAvatar } from "@/components/page";
import { notify } from "@/components/toast";

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      const { error } = await authClient.updateUser({ name: value.trim() });
      if (error) return void notify.error(error.message ?? "Couldn't update your name");
      notify.success("Profile updated");
      router.refresh();
    });
  };

  return (
    <Card className="shadow-xs">
      <form onSubmit={save} className="contents">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your personal details shown across envman.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <UserAvatar name={value || name} className="size-14 [&_[data-slot=avatar-fallback]]:text-lg" />
            <div>
              <p className="font-medium">{value || name}</p>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name" id="profile-name" value={value} onChange={(e) => setValue(e.target.value)} required maxLength={60} />
            <Field label="Email address" id="profile-email" value={email} disabled readOnly hint="Email can't be changed." />
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t bg-muted/40 py-3">
          <Button disabled={pending || value.trim() === name || !value.trim()}>{pending ? "Saving…" : "Save changes"}</Button>
        </CardFooter>
      </form>
    </Card>
  );
}
