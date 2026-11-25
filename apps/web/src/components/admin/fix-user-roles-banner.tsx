"use client";

import { useEffect, useState } from "react";
import { Button } from "@cloudflare/kumo";
import { toast } from "sonner";
import { checkUserRolesAction, fixUserRolesAction } from "@/app/actions/fix-roles";

/**
 * Maintenance banner: only renders when some accounts still carry the legacy
 * "USER" role. Lives on User Management (moved off the dashboard header).
 */
export function FixUserRolesBanner({ onFixed }: { onFixed?: () => void }) {
  const [legacyCount, setLegacyCount] = useState(0);
  const [fixing, setFixing] = useState(false);

  const check = async () => {
    const res = await checkUserRolesAction();
    if (res.success && res.data) setLegacyCount(res.data.userRole || 0);
  };

  useEffect(() => {
    void check();
  }, []);

  if (legacyCount === 0) return null;

  const fix = async () => {
    setFixing(true);
    try {
      const res = await fixUserRolesAction();
      if (res.success) {
        toast.success(res.message || "User roles fixed");
        await check();
        onFixed?.();
      } else {
        toast.error(res.error || "Failed to fix user roles");
      }
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-kumo-line bg-kumo-base p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-kumo-default">
        <span className="font-semibold text-kumo-warning">
          {legacyCount} account{legacyCount === 1 ? "" : "s"}
        </span>{" "}
        still use the legacy &quot;USER&quot; role and should be converted to Customer.
      </p>
      <Button variant="secondary" loading={fixing} onClick={fix} className="shrink-0">
        Fix roles
      </Button>
    </div>
  );
}
