"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button, Checkbox, Input, Loader } from "@cloudflare/kumo";
import { verifyPasswordResetTokenAction, resetPasswordAction } from "@/app/actions/auth";

// ─── Step 1: Verify 6-digit code ───────────────────────────────────────────
function VerifyCodeStep({
  email,
  onVerified,
}: {
  email: string;
  onVerified: (token: string) => void;
}) {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    if (code.length !== 6) {
      setError("Please enter the full 6-digit code from your email.");
      return;
    }
    setIsLoading(true);
    setError(null);
    const res = await verifyPasswordResetTokenAction(email, code);
    setIsLoading(false);
    if (res.success) {
      onVerified(code);
    } else {
      setError(res.error || "Invalid code. Please try again.");
    }
  };

  return (
    <form
      className="space-y-5 p-6 sm:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        void handleVerify();
      }}
    >
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-kumo-default">Enter your recovery code</h1>
        <p className="mt-1 text-sm text-kumo-subtle">
          We sent a 6-digit code to <span className="wrap-anywhere font-semibold text-kumo-default">{email || "your email"}</span>.
        </p>
      </div>

      <ErrorNote message={error} />

      <Input
        label="Recovery code"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => {
          setCode(e.target.value.replace(/\D/g, ""));
          if (error) setError(null);
        }}
        placeholder="6 digits"
        className="w-full"
      />

      <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={isLoading} disabled={isLoading || code.length !== 6}>
        Verify Code
      </Button>

      <p className="text-center text-sm text-kumo-subtle">
        Didn&apos;t get a code?{" "}
        <a href="/" className="font-semibold text-kumo-link hover:underline">
          Go back and request again
        </a>
      </p>
    </form>
  );
}

// ─── Step 2: Set new password ───────────────────────────────────────────────
function SetPasswordStep({
  email,
  token,
  onBack,
}: {
  email: string;
  token: string;
  onBack: () => void;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match. Please try again.");
      return;
    }
    setIsLoading(true);
    const res = await resetPasswordAction({ email, token, newPassword: password });
    setIsLoading(false);
    if (res.success) {
      setIsSuccess(true);
      setTimeout(() => router.push("/"), 3000);
    } else {
      setError(res.error || "Failed to update password.");
    }
  };

  if (isSuccess) {
    return (
      <div className="p-8 text-center">
        <h2 className="font-display text-2xl font-semibold text-kumo-default">Password updated</h2>
        <p className="mt-2 text-sm text-kumo-subtle">Taking you back to sign in...</p>
      </div>
    );
  }

  const mismatch = !!confirmPassword && confirmPassword !== password;

  return (
    <form
      className="space-y-5 p-6 sm:p-8"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-kumo-default">Set a new password</h1>
        <p className="mt-1 text-sm text-kumo-success">Code checked. Enter your new password twice.</p>
      </div>

      <ErrorNote message={error} />

      <Input
        label="New password"
        type={showPass ? "text" : "password"}
        autoComplete="new-password"
        value={password}
        onChange={(e) => {
          setPassword(e.target.value);
          if (error) setError(null);
        }}
        placeholder="At least 6 characters"
        className="w-full"
      />
      <div className="space-y-1.5">
        <Input
          label="Confirm password"
          type={showPass ? "text" : "password"}
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            if (error) setError(null);
          }}
          placeholder="Repeat your password"
          className="w-full"
        />
        {confirmPassword && (
          <p className={mismatch ? "text-sm text-kumo-danger" : "text-sm text-kumo-success"}>
            {mismatch ? "Passwords do not match" : "Passwords match"}
          </p>
        )}
      </div>
      <Checkbox label="Show passwords" checked={showPass} onCheckedChange={(v) => setShowPass(Boolean(v))} />

      <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={isLoading} disabled={isLoading}>
        Update password
      </Button>
      <Button type="button" variant="ghost" className="w-full justify-center" onClick={onBack}>
        Use a different code
      </Button>
    </form>
  );
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg bg-kumo-danger-tint p-3 text-sm font-medium text-kumo-danger">
      {message}
    </p>
  );
}

// ─── Main form orchestrator ─────────────────────────────────────────────────
function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [step, setStep] = useState<"verify" | "set-password">("verify");
  const [verifiedToken, setVerifiedToken] = useState("");

  const handleVerified = (token: string) => {
    setVerifiedToken(token);
    setStep("set-password");
  };

  if (step === "set-password") {
    return (
      <SetPasswordStep
        email={email}
        token={verifiedToken}
        onBack={() => setStep("verify")}
      />
    );
  }

  return <VerifyCodeStep email={email} onVerified={handleVerified} />;
}

// ─── Page wrapper ───────────────────────────────────────────────────────────
export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-kumo-recessed p-4 sm:p-6">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-kumo-line bg-kumo-base">
        <Suspense
          fallback={
            <div className="flex justify-center p-16">
              <Loader />
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
