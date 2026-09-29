"use client";

import { useState } from "react";
import { useTabParam } from "@/lib/use-tab-param";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Bell, Lock, LogOut, Shield, User } from "lucide-react";
import { useAuth } from "@/app/providers";
import { SaveBar, SettingsCard, SettingsShell, SecondaryButton, type SettingsTab } from "@/components/settings/settings-ui";
import { NotificationsCard, PasswordCard } from "@/components/settings/settings-cards";
import { ProfileCard } from "@/components/settings/profile-card";
import { useMyAccount } from "@/components/settings/use-my-account";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";

type Tab = "profile" | "password" | "notifications" | "role";

const TABS: SettingsTab<Tab>[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "password", label: "Password", icon: Lock },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "role", label: "Your role", icon: Shield },
];

const ADMIN_AREAS = [
  { label: "Tenants, leases & billing", href: "/admindashboard/tenant-monitoring" },
  { label: "Bookings, reservations & applications", href: "/admindashboard/bookings" },
  { label: "Units & floor plan", href: "/admindashboard/space-manager" },
  { label: "Ads & tenant promos", href: "/admindashboard/ad-scheduler" },
  { label: "Users, reviews & blacklist", href: "/admindashboard/user-management" },
  { label: "Public website content", href: "/admindashboard/public-view-cms" },
];

export default function AdminProfileSettings() {
  const router = useRouter();
  const { logout } = useAuth();
  const me = useMyAccount();
  const [tab, setTab] = useState<Tab>("profile");
  useTabParam(TABS, setTab);

  if (me.error) {
    return (
      <div className="p-10 text-center space-y-3">
        <AlertTriangle className="mx-auto text-primary" size={28} />
        <p className="font-bold text-charcoal dark:text-white">{me.error}</p>
        <SecondaryButton onClick={() => me.reload()}>Try again</SecondaryButton>
      </div>
    );
  }
  if (!me.account || !me.form) return <DashboardSkeleton />;

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-[1400px] mx-auto animate-fade-in-up">
      <SettingsShell
        eyebrow="Account"
        title="Profile"
        accent="Settings."
        subtitle="Your admin profile, password and notification preferences."
        tabs={TABS}
        active={tab}
        onTab={setTab}
      >
        {tab === "profile" && (
          <>
            <ProfileCard me={me} showAdminFields />
            <SaveBar dirty={me.dirty} saving={me.saving} blocked={me.problem} onSave={me.save} onDiscard={me.discard} />
          </>
        )}

        {tab === "password" && (
          <PasswordCard userId={me.account.id} email={me.account.email} hasPassword={me.account.hasPassword} />
        )}

        {tab === "notifications" && <NotificationsCard userId={me.account.id} role="ADMIN" />}

        {tab === "role" && (
          <SettingsCard title="Administrator" subtitle="Full access to the SR Mall back office." icon={Shield}>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {ADMIN_AREAS.map((a) => (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-slate-100 dark:border-white/5 hover:border-primary/30 hover:bg-primary/5 transition-colors text-sm font-bold text-charcoal dark:text-white"
                  >
                    {a.label} <ArrowRight size={14} className="text-slate-300" />
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500">
              Roles are managed in <Link href="/admindashboard/user-management" className="font-bold text-primary hover:underline">User Management</Link>.
              An admin can't remove their own admin role or delete the last admin.
            </p>
            <SecondaryButton
              type="button"
              onClick={() => {
                logout();
                router.push("/public-view");
              }}
            >
              <LogOut size={14} /> Log out
            </SecondaryButton>
          </SettingsCard>
        )}
      </SettingsShell>
    </div>
  );
}
