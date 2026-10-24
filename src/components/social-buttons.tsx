"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui";

type Providers = { github: boolean; google: boolean };

export function SocialButtons({ providers }: { providers: Providers }) {
  const [pending, setPending] = useState<string | null>(null);
  const enabled = (["github", "google"] as const).filter((p) => providers[p]);
  if (enabled.length === 0) return null;

  return (
    <>
      <div className="flex flex-col gap-2">
        {enabled.map((provider) => (
          <Button
            key={provider}
            type="button"
            variant="outline"
            disabled={pending !== null}
            onClick={async () => {
              setPending(provider);
              await authClient.signIn.social({ provider, callbackURL: "/dashboard" });
            }}
          >
            {pending === provider ? "Redirecting…" : `Continue with ${provider === "github" ? "GitHub" : "Google"}`}
          </Button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-xs text-black/50 dark:text-white/50">
        <span className="h-px flex-1 bg-current opacity-30" /> or <span className="h-px flex-1 bg-current opacity-30" />
      </div>
    </>
  );
}
