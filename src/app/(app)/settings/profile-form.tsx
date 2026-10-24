"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { authClient } from "@/lib/auth-client";
import { Button, Input } from "@/components/ui";
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
    <form onSubmit={save} className="flex flex-col gap-4 sm:max-w-sm">
      <Input label="Name" value={value} onChange={(e) => setValue(e.target.value)} required maxLength={60} />
      <Input label="Email" value={email} disabled readOnly className="opacity-60" />
      <Button disabled={pending || value.trim() === name} className="self-start">
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
