"use client";

import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { currentModule } from "@/components/app-switcher";
import { useVault } from "@/components/vault/vault-provider";
import { notify } from "@/components/toast";

/** Current module name in the top bar. */
export function ModuleLabel() {
  return <span className="ml-1 text-sm text-muted-foreground">{currentModule(usePathname()).name}</span>;
}

/** "Lock" button shown while the vault is unlocked. */
export function VaultLockButton() {
  const pathname = usePathname();
  const { unlocked, lock } = useVault();
  if (!unlocked || !pathname.startsWith("/vault")) return null;
  return (
    <Button
      variant="outline"
      onClick={() => {
        lock();
        notify.info("Vault locked");
      }}
    >
      <Lock /> Lock
    </Button>
  );
}
