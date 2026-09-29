"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { toast } from "sonner";
import { AlertTriangle, Bell, Camera, Eye, EyeOff, KeyRound, Loader2, Lock, Send, Trash2 } from "lucide-react";
import { supabase } from "@/utils/supabase";
import {
  getNotificationSettings,
  saveNotificationSettings,
  sendTestNotification,
  type NotificationSettings,
} from "@/app/actions/notifications";
import {
  NOTIFICATION_GROUPS,
  catalogForRole,
  type NotificationChannel,
  type NotificationGroup,
} from "@/lib/notification-catalog";
import { Field, INPUT_CLASS, PrimaryButton, SecondaryButton, SettingsCard } from "./settings-ui";

// ─── Photo ───────────────────────────────────────────────────────────────────

export function PhotoPicker({
  src,
  fallback,
  label = "Profile photo",
  hint = "PNG or JPG, up to 5 MB.",
  rounded = "rounded-full",
  onUpload,
}: {
  src?: string | null;
  fallback: string;
  label?: string;
  hint?: string;
  rounded?: string;
  /** Upload the file; resolve with the new URL, or throw/return null on failure. */
  onUpload: (file: File) => Promise<string | null>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Images must be under 5 MB.");
    setBusy(true);
    try {
      const url = await onUpload(file);
      if (url) toast.success(`${label} updated`);
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex items-center gap-5">
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={busy}
        aria-label={`Change ${label.toLowerCase()}`}
        className={clsx(
          "relative w-24 h-24 shrink-0 overflow-hidden bg-primary/10 text-primary flex items-center justify-center text-3xl font-black italic group",
          rounded,
        )}
      >
        {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : fallback.charAt(0).toUpperCase()}
        <span className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
          {busy ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
        </span>
      </button>
      <div className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</p>
        <SecondaryButton type="button" onClick={() => input.current?.click()} disabled={busy} className="h-9 px-4">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />} Change
        </SecondaryButton>
        <p className="text-xs text-slate-400">{hint}</p>
      </div>
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
    </div>
  );
}

// ─── Password ────────────────────────────────────────────────────────────────

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} className={clsx(INPUT_CLASS, "pr-11")} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-primary"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

/**
 * Change password — or, for accounts created with Google that have no
 * password yet, send a code to set one (reset-password page).
 */
export function PasswordCard({ userId, email, hasPassword }: { userId: string; email: string; hasPassword: boolean }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < 8;
  const canSave = hasPassword && current && next.length >= 8 && next === confirm;

  const sendCode = async () => {
    setBusy(true);
    try {
      const { requestPasswordResetAction } = await import("@/app/actions/auth");
      const res = await requestPasswordResetAction(email);
      if (res.success) {
        toast.success("We emailed you a 6-digit code");
        router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
      } else {
        toast.error(res.error || "Couldn't send the code");
      }
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      const { updateSecurityAction } = await import("@/app/actions/auth");
      const res = await updateSecurityAction(userId, { currentPassword: current, newPassword: next });
      if (res.success) {
        toast.success("Password changed");
        setCurrent("");
        setNext("");
        setConfirm("");
      } else {
        toast.error(res.error || "Couldn't change the password");
      }
    } finally {
      setBusy(false);
    }
  };

  if (!hasPassword) {
    return (
      <SettingsCard title="Password" subtitle="You sign in with Google. You can also add a password." icon={KeyRound}>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Your account has no SR Mall password yet, so you sign in with <strong>Continue with Google</strong>. To also
          sign in with email + password, we&apos;ll email a code to <strong>{email}</strong>.
        </p>
        <PrimaryButton type="button" onClick={sendCode} busy={busy}>
          <Send size={14} /> Email me a code to set a password
        </PrimaryButton>
      </SettingsCard>
    );
  }

  return (
    <SettingsCard
      title="Password"
      subtitle="Use at least 8 characters."
      icon={Lock}
      footer={
        <>
          <button type="button" onClick={sendCode} disabled={busy} className="mr-auto text-xs font-bold text-primary hover:underline disabled:opacity-50">
            Forgot your current password?
          </button>
          <PrimaryButton type="button" onClick={save} busy={busy} disabled={!canSave}>
            Change password
          </PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field label="Current password">
          <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="New password" error={tooShort ? "At least 8 characters" : null}>
          <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password" error={mismatch ? "Passwords don't match" : null}>
          <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
      </div>
    </SettingsCard>
  );
}

// ─── Notifications ───────────────────────────────────────────────────────────

const CHANNEL_LABEL: Record<NotificationChannel, string> = { IN_APP: "In-app", EMAIL: "Email", SMS: "SMS" };

export function NotificationsCard({ userId, role }: { userId: string; role: "ADMIN" | "TENANT" | "CUSTOMER" }) {
  const [prefs, setPrefs] = useState<NotificationSettings | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const items = catalogForRole(role);

  useEffect(() => {
    let cancelled = false;
    getNotificationSettings(userId).then((res) => {
      if (cancelled) return;
      const data = res.success && res.data ? res.data : {};
      setPrefs(data);
      setSaved(JSON.stringify(data));
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const dirty = prefs !== null && JSON.stringify(prefs) !== saved;

  const update = (type: string, patch: Partial<{ enabled: boolean; channels: NotificationChannel[] }>) =>
    setPrefs((prev) => {
      if (!prev) return prev;
      const meta = items.find((m) => m.type === type);
      const current = prev[type] ?? { enabled: meta?.defaultEnabled ?? true, channels: meta?.defaultChannels ?? ["IN_APP"] };
      return { ...prev, [type]: { ...current, ...patch } };
    });

  const toggleChannel = (type: string, channel: NotificationChannel, channels: NotificationChannel[]) => {
    const next = channels.includes(channel) ? channels.filter((c) => c !== channel) : [...channels, channel];
    update(type, { channels: next.length ? next : ["IN_APP"] });
  };

  const save = async () => {
    if (!prefs) return;
    setBusy(true);
    try {
      const res = await saveNotificationSettings(userId, prefs);
      if (res.success) {
        setSaved(JSON.stringify(prefs));
        toast.success("Notification settings saved");
      } else {
        toast.error(res.error || "Couldn't save notification settings");
      }
    } finally {
      setBusy(false);
    }
  };

  const test = async (type: string) => {
    const res = await sendTestNotification(userId, type);
    if (res.success) toast.success("Test notification sent", { description: res.message });
    else toast.error(res.error || "Couldn't send the test");
  };

  return (
    <SettingsCard
      title="Notifications"
      subtitle="Choose what you're told about, and where."
      icon={Bell}
      footer={
        <PrimaryButton type="button" onClick={save} busy={busy} disabled={!dirty}>
          {dirty ? "Save notification settings" : "Saved"}
        </PrimaryButton>
      }
    >
      {!prefs ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">There are no notification settings for your account.</p>
      ) : (
        <div className="space-y-8">
          {(["MONEY", "ACTION", "SECURITY", "INFO"] as NotificationGroup[]).map((groupKey) => {
            const group = items.filter((m) => m.group === groupKey);
            if (!group.length) return null;
            return (
              <div key={groupKey} className="space-y-1">
                <div className="pb-2 border-b border-slate-100 dark:border-white/5">
                  <h3 className="text-[11px] font-black uppercase tracking-widest text-primary">
                    {NOTIFICATION_GROUPS[groupKey].label}
                  </h3>
                  <p className="text-xs text-slate-400">{NOTIFICATION_GROUPS[groupKey].hint}</p>
                </div>
                <ul className="divide-y divide-slate-100 dark:divide-white/5">
                  {group.map((item) => {
                    const setting = prefs[item.type];
                    const enabled = setting?.enabled ?? item.defaultEnabled;
                    const channels = setting?.channels ?? item.defaultChannels;
                    return (
                      <li key={item.type} className="flex flex-col md:flex-row md:items-center justify-between gap-3 py-4">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-charcoal dark:text-white">{item.label}</p>
                          <p className="text-xs text-slate-400">{item.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {(["IN_APP", "EMAIL"] as NotificationChannel[]).map((ch) => (
                            <button
                              key={ch}
                              type="button"
                              disabled={!enabled}
                              onClick={() => toggleChannel(item.type, ch, channels)}
                              aria-pressed={channels.includes(ch)}
                              className={clsx(
                                "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-colors disabled:opacity-40",
                                channels.includes(ch) && enabled
                                  ? "bg-primary/10 border-primary/40 text-primary"
                                  : "border-slate-200 dark:border-white/10 text-slate-400",
                              )}
                            >
                              {CHANNEL_LABEL[ch]}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => test(item.type)}
                            disabled={!enabled}
                            className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200 dark:border-white/10 text-slate-400 hover:text-primary disabled:opacity-40"
                          >
                            Test
                          </button>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={enabled}
                            aria-label={`${item.label} notifications`}
                            onClick={() => update(item.type, { enabled: !enabled })}
                            className={clsx(
                              "w-12 h-7 rounded-full relative transition-colors shrink-0",
                              enabled ? "bg-primary" : "bg-slate-200 dark:bg-zinc-700",
                            )}
                          >
                            <span
                              className={clsx(
                                "absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform",
                                enabled ? "translate-x-6" : "translate-x-1",
                              )}
                            />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </SettingsCard>
  );
}

// ─── Danger zone ─────────────────────────────────────────────────────────────

/** Confirm-with-password (or fresh Google session) dialog for irreversible actions. */
export function DeleteAccountCard({
  userId,
  hasPassword,
  onDeleted,
}: {
  userId: string;
  hasPassword: boolean;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmDelete = async () => {
    setBusy(true);
    setError(null);
    try {
      let googleAccessToken: string | undefined;
      if (!hasPassword) {
        const { data } = await supabase.auth.getSession();
        googleAccessToken = data.session?.access_token;
      }
      const { deleteMyAccountAction } = await import("@/app/actions/auth");
      const res = await deleteMyAccountAction(userId, { password, googleAccessToken });
      if (res.success) {
        toast.success("Your account was deleted");
        onDeleted();
      } else {
        setError(res.error || "Couldn't delete the account");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard
      title="Delete account"
      subtitle="Permanently remove your account and its data."
      icon={Trash2}
      tone="bg-red-500/10 text-red-600"
    >
      <p className="text-sm text-slate-600 dark:text-slate-300">
        Your profile, reviews, messages and favourites are deleted. This can&apos;t be undone.
      </p>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-red-500/10 text-red-600 text-[11px] font-black uppercase tracking-widest hover:bg-red-600 hover:text-white transition-colors"
      >
        <Trash2 size={14} /> Delete my account
      </button>

      {open && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !busy && setOpen(false)} />
          <div role="dialog" aria-modal="true" className="relative w-full max-w-md bg-white dark:bg-zinc-950 rounded-[2rem] shadow-2xl p-7 space-y-5 animate-fade-in-up">
            <div className="flex items-start gap-3">
              <span className="w-11 h-11 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </span>
              <div>
                <h2 className="text-lg font-black text-charcoal dark:text-white">Delete your account?</h2>
                <p className="text-sm text-slate-500">This permanently removes your account. It can&apos;t be undone.</p>
              </div>
            </div>
            {hasPassword ? (
              <Field label="Enter your password to confirm" error={error}>
                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoFocus autoComplete="current-password" />
              </Field>
            ) : (
              <Field label='Type "DELETE" to confirm' error={error} hint="You'll be asked to have an active Google sign-in.">
                <input value={typed} onChange={(e) => setTyped(e.target.value)} className={INPUT_CLASS} autoFocus />
              </Field>
            )}
            <div className="flex gap-3">
              <SecondaryButton type="button" onClick={() => setOpen(false)} disabled={busy} className="flex-1">
                Cancel
              </SecondaryButton>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={busy || (hasPassword ? !password : typed !== "DELETE")}
                className="flex-1 inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-red-600 hover:bg-red-700 text-white text-[11px] font-black uppercase tracking-widest disabled:opacity-50"
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </SettingsCard>
  );
}
