"use client";

import { User } from "lucide-react";
import { Field, INPUT_CLASS, SettingsCard } from "./settings-ui";
import { PhotoPicker } from "./settings-cards";
import type { useMyAccount } from "./use-my-account";

/** Photo, name, email, phone (+ department/bio for admins). Saved with the page's SaveBar. */
export function ProfileCard({
  me,
  showAdminFields = false,
}: {
  me: ReturnType<typeof useMyAccount>;
  showAdminFields?: boolean;
}) {
  const { account, form, set, uploadAvatar } = me;
  if (!account || !form) return null;
  const emailLocked = !account.hasPassword;

  return (
    <SettingsCard title="Profile" subtitle="How you appear across SR Mall." icon={User}>
      <PhotoPicker src={account.avatarUrl} fallback={form.name || account.email} onUpload={uploadAvatar} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field label="Full name">
          <input
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            className={INPUT_CLASS}
            placeholder="Juan Dela Cruz"
            autoComplete="name"
            maxLength={80}
          />
        </Field>
        <Field
          label="Email"
          hint={
            emailLocked
              ? "This is the Gmail you sign in with through Google, so it can't be changed."
              : "Must be a @gmail.com address."
          }
        >
          <input
            type="email"
            value={form.email}
            onChange={(e) => set({ email: e.target.value })}
            disabled={emailLocked}
            className={INPUT_CLASS}
            placeholder="you@gmail.com"
            autoComplete="email"
          />
        </Field>
        <Field label="Phone" hint="Optional. Used by the mall office to reach you.">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => set({ phone: e.target.value })}
            className={INPUT_CLASS}
            placeholder="+63 912 345 6789"
            autoComplete="tel"
            maxLength={20}
          />
        </Field>
        {showAdminFields && (
          <Field label="Department or role">
            <input
              value={form.department}
              onChange={(e) => set({ department: e.target.value })}
              className={INPUT_CLASS}
              placeholder="Mall Operations"
              maxLength={120}
            />
          </Field>
        )}
        {showAdminFields && (
          <Field label="Bio" className="md:col-span-2" hint={`${form.bio.length}/500`}>
            <textarea
              value={form.bio}
              onChange={(e) => set({ bio: e.target.value.slice(0, 500) })}
              rows={3}
              className={`${INPUT_CLASS} resize-none`}
              placeholder="What you look after at SR Mall"
            />
          </Field>
        )}
      </div>
    </SettingsCard>
  );
}
