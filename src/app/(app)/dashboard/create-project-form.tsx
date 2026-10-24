"use client";

import { useActionState } from "react";
import { createProject } from "@/app/actions";
import { Button } from "@/components/ui";

export function CreateProjectForm() {
  const [state, action, pending] = useActionState(createProject, null);
  return (
    <form action={action} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          name="name"
          required
          maxLength={60}
          placeholder="New project name"
          className="flex-1 rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none dark:border-white/20"
        />
        <Button disabled={pending}>{pending ? "Creating…" : "Create"}</Button>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
