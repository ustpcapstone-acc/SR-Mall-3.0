"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTabParam } from "@/lib/use-tab-param";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { toast } from "sonner";
import { AlertTriangle, Bell, Loader2, Lock, MapPin, Power, Store, User } from "lucide-react";
import { useAuth } from "@/app/providers";
import { SHOP_CATEGORIES } from "@/lib/shop-categories";
import {
  deactivateTenantTerminalAction,
  getMyShopSettingsAction,
  updateMyShopSettingsAction,
  uploadShopLogoAction,
  type MyShopSettings,
} from "@/app/actions/tenant";
import {
  Field,
  INPUT_CLASS,
  PHONE_RE,
  SaveBar,
  SecondaryButton,
  SettingsCard,
  SettingsShell,
  useUnsavedWarning,
  type SettingsTab,
} from "@/components/settings/settings-ui";
import { NotificationsCard, PasswordCard, PhotoPicker } from "@/components/settings/settings-cards";
import { ProfileCard } from "@/components/settings/profile-card";
import { useMyAccount } from "@/components/settings/use-my-account";

type Tab = "profile" | "shop" | "password" | "notifications";

const TABS: SettingsTab<Tab>[] = [
  { key: "profile", label: "Profile", icon: User },
  { key: "shop", label: "Shop", icon: Store },
  { key: "password", label: "Password", icon: Lock },
  { key: "notifications", label: "Notifications", icon: Bell },
];

type ShopForm = Pick<MyShopSettings, "shopName" | "description" | "category" | "phone" | "openingHours">;

function useMyShop(userId?: string) {
  const [shop, setShop] = useState<MyShopSettings | null>(null);
  const [form, setForm] = useState<ShopForm | null>(null);
  const [saved, setSaved] = useState<ShopForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    const res = await getMyShopSettingsAction(userId);
    if (!res.success) return setError(res.error);
    const s = res.data;
    const f = { shopName: s.shopName, description: s.description, category: s.category, phone: s.phone, openingHours: s.openingHours };
    setShop(s);
    setForm(f);
    setSaved(f);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = Boolean(form && saved && JSON.stringify(form) !== JSON.stringify(saved));
  const problem = useMemo(() => {
    if (!form) return null;
    if (form.shopName.trim().length < 2) return "Enter your shop name";
    if (form.phone.trim() && !PHONE_RE.test(form.phone.trim())) return "Enter a valid shop phone number";
    return null;
  }, [form]);

  const save = async () => {
    if (!userId || !form || problem) return;
    setSaving(true);
    try {
      const res = await updateMyShopSettingsAction(userId, form);
      if (res.success) {
        setSaved(form);
        setShop((s) => (s ? { ...s, ...form } : s));
        toast.success("Shop details saved");
      } else toast.error(res.error || "Couldn't save your shop");
    } finally {
      setSaving(false);
    }
  };

  const uploadLogo = async (file: File) => {
    if (!userId) return null;
    const data = new FormData();
    data.append("file", file);
    const res = await uploadShopLogoAction(userId, data);
    if (!res.success || !res.url) throw new Error(res.error || "Upload failed");
    setShop((s) => (s ? { ...s, logoUrl: res.url! } : s));
    return res.url;
  };

  return {
    shop,
    form,
    set: (patch: Partial<ShopForm>) => setForm((f) => (f ? { ...f, ...patch } : f)),
    dirty,
    problem,
    saving,
    save,
    discard: () => saved && setForm(saved),
    uploadLogo,
    error,
    reload: load,
    setStatus: (status: string) => setShop((s) => (s ? { ...s, status } : s)),
  };
}

export default function TenantProfileSettings() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const me = useMyAccount();
  const myShop = useMyShop(user?.id);
  const [tab, setTab] = useState<Tab>("profile");
  useTabParam(TABS, setTab);
  const [closeOpen, setCloseOpen] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [closing, setClosing] = useState(false);

  useUnsavedWarning(myShop.dirty);

  if (me.error || myShop.error) {
    return (
      <div className="p-10 text-center space-y-3">
        <AlertTriangle className="mx-auto text-primary" size={28} />
        <p className="font-bold text-charcoal dark:text-white">{me.error || myShop.error}</p>
        <SecondaryButton onClick={() => (me.reload(), myShop.reload())}>Try again</SecondaryButton>
      </div>
    );
  }
  if (!me.account || !me.form || !myShop.shop || !myShop.form) {
    return (
      <div className="p-24 flex justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const shop = myShop.shop;
  const sf = myShop.form;

  const closeShop = async () => {
    if (!user?.id) return;
    setClosing(true);
    try {
      const res = await deactivateTenantTerminalAction(user.id);
      if (res.success) {
        toast.success("Your shop is closed. Contact the mall admin to reopen it.");
        myShop.setStatus("SUSPENDED");
        setCloseOpen(false);
      } else toast.error(res.error || "Couldn't close the shop");
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-[1400px] mx-auto animate-fade-in-up">
      <SettingsShell
        eyebrow="Account"
        title="Profile"
        accent="Settings."
        subtitle="Your personal profile, your shop's public details, password and notifications."
        tabs={TABS}
        active={tab}
        onTab={setTab}
      >
        {tab === "profile" && (
          <>
            <ProfileCard me={me} />
            <SaveBar dirty={me.dirty} saving={me.saving} blocked={me.problem} onSave={me.save} onDiscard={me.discard} />
          </>
        )}

        {tab === "shop" && (
          <>
            <SettingsCard title="Shop details" subtitle="Shown on your public shop page and in the mall directory." icon={Store}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <PhotoPicker
                  src={shop.logoUrl}
                  fallback={sf.shopName || "S"}
                  label="Shop logo"
                  hint="Square PNG or JPG, up to 5 MB."
                  rounded="rounded-2xl"
                  onUpload={myShop.uploadLogo}
                />
                <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500">
                    <MapPin size={12} /> Unit {shop.unitId && !/PENDING|UNASSIGNED/.test(shop.unitId) ? shop.unitId : "not assigned"}
                  </span>
                  <span
                    className={clsx(
                      "px-3 py-1.5 rounded-full border",
                      shop.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                        : "bg-red-500/10 text-red-600 border-red-500/20",
                    )}
                  >
                    {shop.status === "ACTIVE" ? "Open" : shop.status === "SUSPENDED" ? "Closed" : shop.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Field label="Shop name">
                  <input value={sf.shopName} onChange={(e) => myShop.set({ shopName: e.target.value })} className={INPUT_CLASS} maxLength={80} />
                </Field>
                <Field label="Category">
                  <select value={sf.category} onChange={(e) => myShop.set({ category: e.target.value })} className={INPUT_CLASS}>
                    {!(SHOP_CATEGORIES as readonly string[]).includes(sf.category) && <option value={sf.category}>{sf.category}</option>}
                    {SHOP_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Shop phone" hint="Customers can tap to call from your shop page.">
                  <input
                    type="tel"
                    value={sf.phone}
                    onChange={(e) => myShop.set({ phone: e.target.value })}
                    className={INPUT_CLASS}
                    placeholder="+63 912 345 6789"
                    maxLength={20}
                  />
                </Field>
                <Field label="Opening hours">
                  <input
                    value={sf.openingHours}
                    onChange={(e) => myShop.set({ openingHours: e.target.value })}
                    className={INPUT_CLASS}
                    placeholder="Mon–Sun, 10:00 AM – 9:00 PM"
                    maxLength={120}
                  />
                </Field>
                <Field label="About your shop" className="md:col-span-2" hint={`${sf.description.length}/1000`}>
                  <textarea
                    value={sf.description}
                    onChange={(e) => myShop.set({ description: e.target.value.slice(0, 1000) })}
                    rows={4}
                    className={`${INPUT_CLASS} resize-none`}
                    placeholder="What you sell, what makes your shop special…"
                  />
                </Field>
              </div>
            </SettingsCard>

            {shop.status === "ACTIVE" && (
              <SettingsCard title="Close my shop" subtitle="Hide your shop from customers." icon={Power} tone="bg-red-500/10 text-red-600">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Your shop disappears from the directory and customers can&apos;t message it. Only the mall admin can reopen it.
                </p>
                <button
                  type="button"
                  onClick={() => setCloseOpen(true)}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-red-500/10 text-red-600 text-[11px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-colors"
                >
                  <Power size={14} /> Close my shop
                </button>
              </SettingsCard>
            )}

            <SaveBar dirty={myShop.dirty} saving={myShop.saving} blocked={myShop.problem} onSave={myShop.save} onDiscard={myShop.discard} />
          </>
        )}

        {tab === "password" && <PasswordCard userId={me.account.id} email={me.account.email} hasPassword={me.account.hasPassword} />}

        {tab === "notifications" && <NotificationsCard userId={me.account.id} role="TENANT" />}
      </SettingsShell>

      {closeOpen && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !closing && setCloseOpen(false)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md bg-white dark:bg-zinc-950 rounded-[2rem] shadow-2xl p-7 space-y-5 animate-fade-in-up">
            <div>
              <h2 className="text-lg font-black text-charcoal dark:text-white">Close {shop.shopName}?</h2>
              <p className="text-sm text-slate-500 mt-1">
                Customers won&apos;t see or message your shop. You&apos;ll need the mall admin to reopen it.
              </p>
            </div>
            <Field label={`Type "${shop.shopName}" to confirm`}>
              <input value={typedName} onChange={(e) => setTypedName(e.target.value)} className={INPUT_CLASS} autoFocus />
            </Field>
            <div className="flex gap-3">
              <SecondaryButton type="button" onClick={() => setCloseOpen(false)} disabled={closing} className="flex-1">
                Cancel
              </SecondaryButton>
              <button
                type="button"
                onClick={closeShop}
                disabled={closing || typedName.trim() !== shop.shopName.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                {closing ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />} Close shop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
