"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Shield } from "lucide-react";
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
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-amber-500/30 bg-amber-50 dark:bg-amber-500/10">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        <span className="font-bold">{legacyCount} account{legacyCount === 1 ? "" : "s"}</span>{" "}
        still use the legacy &quot;USER&quot; role and should be converted to Customer.
      </p>
      <button
        onClick={fix}
        disabled={fixing}
        className="shrink-0 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
      >
        {fixing ? <RefreshCw size={14} className="animate-spin" /> : <Shield size={14} />}
        Fix roles
      </button>
    </div>
  );
}
