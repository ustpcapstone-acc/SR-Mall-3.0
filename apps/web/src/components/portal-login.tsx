"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Banner, Button, Input } from "@cloudflare/kumo";
import { loginAction, requestPasswordResetAction } from "@/app/actions/auth";
import { useAuth } from "@/app/providers";
import { supabase } from "@/utils/supabase";
import { rememberGooglePortal } from "@/lib/google-portal";

type Portal = "ADMIN" | "TENANT";

const COPY: Record<Portal, { eyebrow: string; title: string; description: string; area: string }> = {
  ADMIN: {
    eyebrow: "Staff portal",
    title: "Sign in to SR Mall staff",
    description: "For mall management and staff accounts.",
    area: "/admindashboard",
  },
  TENANT: {
    eyebrow: "Tenant portal",
    title: "Sign in to your tenant account",
    description: "Manage your spaces, storefront and payments.",
    area: "/tenantdashboard",
  },
};

function GoogleIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function PortalLoginForm({ portal }: { portal: Portal }) {
  const copy = COPY[portal];
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"password" | "google" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Return to the page that sent the visitor here, but only inside this portal's area.
  const next = params.get("next");
  const safeNext = next && (next === copy.area || next.startsWith(copy.area + "/")) ? next : null;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy("password");
    setError(null);
    const res = await loginAction({ email, password }, portal);
    if (!res.success || !res.data) {
      setError(res.error || "Invalid email or password.");
      setBusy(null);
      return;
    }
    login(res.data.id, res.data.name, res.data.email, res.data.role, res.data.avatarUrl);
    router.replace(safeNext || res.redirectTo || copy.area);
  };

  const onGoogle = async () => {
    setBusy("google");
    setError(null);
    rememberGooglePortal(portal);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: "select_account" } },
    });
    if (error) {
      setError(error.message || "Google sign-in failed.");
      setBusy(null);
    }
  };

  const onForgot = async () => {
    const value = email.trim();
    if (!value) {
      setError("Enter your email first, then choose Forgot password.");
      return;
    }
    setBusy("reset");
    setError(null);
    const res = await requestPasswordResetAction(value);
    setBusy(null);
    if (res.success) router.push(`/auth/reset-password?email=${encodeURIComponent(value)}`);
    else setError(res.error || "Couldn't send the reset email.");
  };

  return (
    <main className="flex min-h-svh items-center justify-center bg-kumo-recessed px-4 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 block text-center font-display text-2xl font-semibold text-kumo-default">
          SR Mall
        </Link>
        <div className="rounded-xl border border-kumo-line bg-kumo-base p-6 shadow-sm sm:p-8">
          <p className="text-xs font-medium uppercase tracking-wide text-kumo-subtle">{copy.eyebrow}</p>
          <h1 className="mt-1 text-xl font-semibold text-kumo-default">{copy.title}</h1>
          <p className="mt-1 text-sm text-kumo-subtle">{copy.description}</p>

          {error && <Banner variant="error" className="mt-5" description={error} />}

          <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onForgot}
                disabled={busy !== null}
                className="text-sm text-kumo-link hover:underline disabled:opacity-50"
              >
                Forgot password?
              </button>
            </div>
            <Button type="submit" variant="primary" className="w-full" loading={busy === "password"} disabled={busy !== null}>
              Sign in
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-kumo-subtle">
            <span className="h-px flex-1 bg-kumo-line" /> or <span className="h-px flex-1 bg-kumo-line" />
          </div>
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            icon={<GoogleIcon />}
            loading={busy === "google"}
            disabled={busy !== null}
            onClick={onGoogle}
          >
            Continue with Google
          </Button>
        </div>

        <p className="mt-6 text-center text-sm text-kumo-subtle">
          {portal === "TENANT" ? (
            <>
              Shopping at SR Mall?{" "}
              <Link href="/login" className="text-kumo-link hover:underline">
                Customer sign-in
              </Link>
            </>
          ) : (
            <Link href="/" className="text-kumo-link hover:underline">
              Back to SR Mall
            </Link>
          )}
        </p>
      </div>
    </main>
  );
}

export function PortalLogin({ portal }: { portal: Portal }) {
  return (
    <Suspense fallback={null}>
      <PortalLoginForm portal={portal} />
    </Suspense>
  );
}
