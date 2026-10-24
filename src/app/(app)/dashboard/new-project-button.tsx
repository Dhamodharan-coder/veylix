"use client";

import { useActionState, useState } from "react";
import { CircleAlert, Plus } from "lucide-react";
import { createProject } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/page";

export function NewProjectButton() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            It starts with development, staging and production environments. You can change them anytime.
          </DialogDescription>
        </DialogHeader>
        {open && <NewProjectForm />}
      </DialogContent>
    </Dialog>
  );
}

function NewProjectForm() {
  // createProject redirects to the new project on success.
  const [state, action, pending] = useActionState(createProject, null);
  return (
    <form action={action} className="grid gap-4">
      {state?.error && (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <Field label="Project name" name="name" required maxLength={60} autoFocus placeholder="e.g. Billing API" />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">Cancel</Button>
        </DialogClose>
        <Button disabled={pending}>{pending ? "Creating…" : "Create project"}</Button>
      </DialogFooter>
    </form>
  );
}
