"use client";

import { useEffect, useState } from "react";
import { useTabParam } from "@/lib/use-tab-param";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Bell, Handshake, Heart, Loader2, Lock, LogOut, Store, Trash2, User, X } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { useAuth } from "@/app/providers";
import { getAllStorefrontsAction } from "@/app/actions/tenant";
import { MerchantApplicationModal } from "@/components/merchant-application-modal";
import {
  PrimaryButton,
  SaveBar,
  SecondaryButton,
  SettingsCard,
  SettingsShell,
  type SettingsTab,
} from "@/components/settings/settings-ui";
import { DeleteAccountCard, NotificationsCard, PasswordCard } from "@/components/settings/settings-cards";
import { ProfileCard } from "@/components/settings/profile-card";
import { useMyAccount } from "@/components/settings/use-my-account";
import { FAVORITES_EVENT, readLocalFavorites, setFavorite, syncFavorites } from "@/lib/favorites";

type Tab = "profile" | "password" | "notifications" | "favorites" | "account";

const TABS: SettingsTab<Tab>[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "password", label: "Password", icon: Lock },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "favorites", label: "Favourites", icon: Heart },
  { key: "account", label: "Account", icon: Trash2 },
];

type Shop = { id: string; shop_name: string; unit_id: string; logo_url: string | null; category?: string };

function FavoritesCard({ userId }: { userId: string }) {
  const [shops, setShops] = useState<Shop[] | null>(null);
  const [ids, setIds] = useState<string[]>(() => readLocalFavorites());

  useEffect(() => {
    let cancelled = false;
    Promise.all([syncFavorites(userId), getAllStorefrontsAction()]).then(([favIds, res]) => {
      if (cancelled) return;
      setIds(favIds);
      setShops(res.success && res.data ? (res.data as Shop[]) : []);
    });
    const refresh = () => setIds(readLocalFavorites());
    window.addEventListener(FAVORITES_EVENT, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(FAVORITES_EVENT, refresh);
    };
  }, [userId]);

  const favorites = (shops || []).filter((s) => ids.includes(s.id));

  return (
    <SettingsCard title="Favourite shops" subtitle="Saved to your account, so they follow you on every device." icon={Heart}>
      {!shops ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : favorites.length === 0 ? (
        <div className="py-10 text-center space-y-3">
          <Heart className="mx-auto text-slate-300" size={32} />
          <p className="text-sm text-slate-500">No favourites yet. Tap the heart on any shop to save it here.</p>
          <Link href="/tenant-directory" className="inline-flex text-xs font-black uppercase tracking-widest text-primary hover:underline">
            Browse the mall directory →
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {favorites.map((s) => (
            <li key={s.id} className="flex items-center gap-3 p-3 rounded-2xl border border-slate-100 dark:border-white/5">
              <Link href={`/shop/${s.id}`} className="flex items-center gap-3 flex-1 min-w-0 group">
                <span className="w-12 h-12 rounded-xl bg-primary/10 text-primary overflow-hidden flex items-center justify-center font-black shrink-0">
                  {s.logo_url ? <img src={s.logo_url} alt="" className="w-full h-full object-cover" /> : <Store size={18} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-charcoal dark:text-white truncate group-hover:text-primary">{s.shop_name}</span>
                  <span className="block text-xs text-slate-400 truncate">
                    {s.category || "Shop"} · {s.unit_id}
                  </span>
                </span>
              </Link>
              <button
                type="button"
                onClick={async () => {
                  if (!(await setFavorite(s.id, false, userId))) toast.error("Couldn't remove the favourite");
                }}
                aria-label={`Remove ${s.shop_name} from favourites`}
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-500/10"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SettingsCard>
  );
}

export default function CustomerProfile() {
  const router = useRouter();
  const { isAuthenticated, logout } = useAuth();
  const me = useMyAccount();
  const [tab, setTab] = useState<Tab>("profile");
  useTabParam(TABS, setTab);
  const [merchantOpen, setMerchantOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) router.push("/public-view");
  }, [isAuthenticated, router]);

  if (!isAuthenticated) return null;

  const body = me.error ? (
    <div className="py-20 text-center space-y-3">
      <AlertTriangle className="mx-auto text-primary" size={28} />
      <p className="font-bold text-charcoal dark:text-white">{me.error}</p>
      <SecondaryButton onClick={() => me.reload()}>Try again</SecondaryButton>
    </div>
  ) : !me.account || !me.form ? (
    <div className="py-24 flex justify-center">
      <Loader2 className="animate-spin text-primary" size={28} />
    </div>
  ) : (
    <SettingsShell
      eyebrow="My account"
      title="My"
      accent="Profile."
      subtitle="Your details, password, notifications and favourite shops."
      tabs={TABS}
      active={tab}
      onTab={setTab}
    >
      {tab === "profile" && (
        <>
          <ProfileCard me={me} />
          {me.account.role === "CUSTOMER" && (
            <SettingsCard title="Sell at SR Mall" subtitle="Open your own shop in the mall." icon={Handshake}>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Apply for a storefront. The mall office reviews applications and assigns a unit.
              </p>
              <PrimaryButton type="button" onClick={() => setMerchantOpen(true)}>
                <Handshake size={14} /> Apply for a shop
              </PrimaryButton>
            </SettingsCard>
          )}
          <SaveBar dirty={me.dirty} saving={me.saving} blocked={me.problem} onSave={me.save} onDiscard={me.discard} />
        </>
      )}

      {tab === "password" && <PasswordCard userId={me.account.id} email={me.account.email} hasPassword={me.account.hasPassword} />}

      {tab === "notifications" && <NotificationsCard userId={me.account.id} role="CUSTOMER" />}

      {tab === "favorites" && <FavoritesCard userId={me.account.id} />}

      {tab === "account" && (
        <>
          <SettingsCard title="Sign out" subtitle="End your session on this device." icon={LogOut}>
            <SecondaryButton
              type="button"
              onClick={() => {
                logout();
                router.push("/public-view");
              }}
            >
              <LogOut size={14} /> Sign out
            </SecondaryButton>
          </SettingsCard>
          <DeleteAccountCard
            userId={me.account.id}
            hasPassword={me.account.hasPassword}
            onDeleted={() => {
              logout();
              router.push("/public-view");
            }}
          />
        </>
      )}
    </SettingsShell>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black selection:bg-primary selection:text-white">
      <Navbar />
      <main className="pt-28 sm:pt-32 pb-20 px-4">
        <div className="max-w-6xl mx-auto">{body}</div>
      </main>
      <Footer />
      <MerchantApplicationModal isOpen={merchantOpen} onClose={() => setMerchantOpen(false)} />
    </div>
  );
}
