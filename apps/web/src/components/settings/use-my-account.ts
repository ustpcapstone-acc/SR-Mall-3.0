"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/app/providers";
import { getMyAccountAction, updateMyAccountAction, uploadAvatarAction, type MyAccount } from "@/app/actions/auth";
import { GMAIL_RE, PHONE_RE, useUnsavedWarning } from "./settings-ui";

export type ProfileForm = { name: string; email: string; phone: string; bio: string; department: string };

/** Load + edit + save the signed-in user's profile (shared by all settings pages). */
export function useMyAccount() {
  const { user, updateUser } = useAuth();
  const [account, setAccount] = useState<MyAccount | null>(null);
  const [form, setForm] = useState<ProfileForm | null>(null);
  const [saved, setSaved] = useState<ProfileForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const res = await getMyAccountAction(user.id);
    if (!res.success) {
      setError(res.error);
      return;
    }
    const a = res.data;
    const f = { name: a.name, email: a.email, phone: a.phone, bio: a.bio, department: a.department };
    setAccount(a);
    setForm(f);
    setSaved(f);
    setError(null);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = Boolean(form && saved && JSON.stringify(form) !== JSON.stringify(saved));
  useUnsavedWarning(dirty);

  const problem = useMemo(() => {
    if (!form) return null;
    if (form.name.trim().length < 2) return "Enter your name (at least 2 characters)";
    if (form.phone.trim() && !PHONE_RE.test(form.phone.trim())) return "Enter a valid phone number";
    if (form.email.trim() && !GMAIL_RE.test(form.email.trim())) return "Your email must be a @gmail.com address";
    return null;
  }, [form]);

  const set = (patch: Partial<ProfileForm>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const save = async () => {
    if (!user?.id || !form || problem) return;
    setSaving(true);
    try {
      const res = await updateMyAccountAction(user.id, form);
      if (res.success && res.data) {
        setSaved(form);
        updateUser({ name: res.data.name, email: res.data.email });
        toast.success("Profile saved");
      } else {
        toast.error(res.error || "Couldn't save your profile");
      }
    } finally {
      setSaving(false);
    }
  };

  const discard = () => saved && setForm(saved);

  const uploadAvatar = async (file: File) => {
    if (!user?.id) return null;
    const data = new FormData();
    data.append("file", file);
    const res = await uploadAvatarAction(user.id, data);
    if (!res.success || !res.data) throw new Error(res.error || "Upload failed");
    updateUser({ avatarUrl: res.data.avatarUrl });
    setAccount((a) => (a ? { ...a, avatarUrl: res.data.avatarUrl } : a));
    return res.data.avatarUrl as string;
  };

  return { user, account, form, set, dirty, problem, saving, save, discard, error, reload: load, uploadAvatar };
}
