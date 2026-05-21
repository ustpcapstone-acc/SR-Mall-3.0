"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Lock, ShieldCheck, AlertCircle, Loader2, CheckCircle2, KeyRound, ArrowLeft, Eye, EyeOff } from "lucide-react";
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
    <div className="p-8 sm:p-12 animate-fade-in-up">
      {/* Header */}
      <div className="mb-8 flex flex-col items-center">
        <div className="w-16 h-16 bg-primary/10 text-primary rounded-3xl flex items-center justify-center mb-4 shadow-sm border border-primary/20">
          <KeyRound size={32} />
        </div>
        <h1 className="text-2xl font-black text-charcoal dark:text-white uppercase tracking-tight">
          Enter Recovery Code
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-2 text-center">
          Check your email and enter the 6-digit code we sent to
        </p>
        <span className="text-xs font-bold text-primary mt-1">{email}</span>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-2xl border border-red-100 dark:border-red-900/30 mb-5 animate-shake">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Code input */}
      <div className="space-y-2 mb-6">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
          6-Digit Recovery Code
        </label>
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "");
            setCode(val);
            if (error) setError(null);
          }}
          placeholder="_ _ _ _ _ _"
          className="w-full px-5 py-5 bg-slate-50 dark:bg-zinc-800 rounded-2xl border-2 border-transparent focus:border-primary outline-none transition-all text-2xl font-black text-charcoal dark:text-white tracking-[0.7em] text-center placeholder:tracking-normal placeholder:text-slate-300 dark:placeholder:text-zinc-600 placeholder:text-base"
        />
      </div>

      <button
        onClick={handleVerify}
        disabled={isLoading || code.length !== 6}
        className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:opacity-90 transition-all active:scale-[0.98] shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isLoading ? <Loader2 className="animate-spin" size={18} /> : "Verify Code"}
      </button>

      <p className="text-center text-xs text-slate-400 mt-5">
        Didn't get a code?{" "}
        <a href="/public-view" className="text-primary font-bold hover:underline">
          Go back and request again
        </a>
      </p>
    </div>
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
  const [showConfirm, setShowConfirm] = useState(false);
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
      <div className="flex flex-col items-center justify-center text-center space-y-6 py-14 px-10 animate-fade-in">
        <div className="w-20 h-20 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-500/20">
          <CheckCircle2 size={40} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-charcoal dark:text-white mb-2">Password Secured!</h2>
          <p className="text-sm text-slate-500 font-medium">
            Your password has been updated. Redirecting you to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 sm:p-12 animate-fade-in-up">
      {/* Header */}
      <div className="mb-8 flex flex-col items-center">
        <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-3xl flex items-center justify-center mb-4 shadow-sm border border-green-500/20">
          <ShieldCheck size={32} />
        </div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-xs font-bold text-green-600 dark:text-green-400">Code Verified</span>
        </div>
        <h1 className="text-2xl font-black text-charcoal dark:text-white uppercase tracking-tight">
          Set New Password
        </h1>
        <p className="text-sm text-slate-500 font-medium mt-2">Enter and confirm your new password.</p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-bold rounded-2xl border border-red-100 dark:border-red-900/30 mb-5 animate-shake">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4 mb-6">
        {/* New Password */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
            New Password
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Minimum 6 characters"
              className="w-full pl-11 pr-11 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border-2 border-transparent focus:border-primary outline-none transition-all text-sm font-bold text-charcoal dark:text-white"
            />
            <button
              type="button"
              onClick={() => setShowPass((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
            Confirm Password
          </label>
          <div className="relative">
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Repeat your password"
              className={`w-full pl-11 pr-11 py-4 bg-slate-50 dark:bg-zinc-800 rounded-2xl border-2 outline-none transition-all text-sm font-bold text-charcoal dark:text-white ${
                confirmPassword && confirmPassword !== password
                  ? "border-red-400"
                  : confirmPassword && confirmPassword === password
                  ? "border-green-400"
                  : "border-transparent focus:border-primary"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {confirmPassword && confirmPassword !== password && (
            <span className="text-[10px] text-red-500 px-1 font-bold">Passwords do not match</span>
          )}
          {confirmPassword && confirmPassword === password && (
            <span className="text-[10px] text-green-500 px-1 font-bold flex items-center gap-1">
              <CheckCircle2 size={10} /> Passwords match
            </span>
          )}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full py-4 bg-primary text-white font-bold rounded-2xl hover:opacity-90 transition-all active:scale-[0.98] shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isLoading ? <Loader2 className="animate-spin" size={18} /> : "Update Credentials"}
      </button>

      <button
        onClick={onBack}
        className="w-full mt-4 text-xs text-slate-400 hover:text-slate-600 flex items-center justify-center gap-1 transition-colors"
      >
        <ArrowLeft size={12} /> Use a different code
      </button>
    </div>
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
    <main className="min-h-screen bg-slate-50 dark:bg-black flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_#be1e2d15,_transparent_40%)]">
      <div className="w-full max-w-lg bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden">
        <Suspense
          fallback={
            <div className="p-20 text-center">
              <Loader2 className="animate-spin mx-auto text-primary" size={40} />
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
