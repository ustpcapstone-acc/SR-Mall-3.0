"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertCircle,
  CheckCircle2,
  LogIn,
  Lock,
  Mail,
  X,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { loginAction, signUpAction } from "@/app/actions/auth";
import { supabase } from "@/utils/supabase";
import { motion, AnimatePresence } from "framer-motion";

const GMAIL_RE = /^[^\s@]+@gmail\.com$/i;

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// New accounts: Gmail addresses only.
const signUpSchema = z.object({
  firstName: z.string().min(2, "First name must be at least 2 characters"),
  lastName: z.string().min(2, "Last name must be at least 2 characters"),
  email: z
    .string()
    .email("Please enter a valid email address")
    .refine((v) => GMAIL_RE.test(v.trim()), "Please use a Gmail address (@gmail.com)"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Official multi-colour Google "G". */
function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

const INPUT =
  "w-full bg-slate-50 dark:bg-zinc-800 rounded-2xl border-2 border-transparent focus:border-primary outline-none transition-all text-sm font-bold text-charcoal dark:text-white";
const LABEL = "text-[10px] font-black text-slate-500 uppercase tracking-widest px-1";

export const LoginModal = ({ isOpen, onClose }: LoginModalProps) => {
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
  } = useForm<any>({
    resolver: zodResolver(isSignUp ? signUpSchema : loginSchema),
  });

  const router = useRouter();

  // Auto-focus email input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const input = document.querySelector('input[type="email"]') as HTMLInputElement;
        if (input) input.focus();
      }, 100);
    }
  }, [isOpen, isSignUp, isForgotPassword]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const toggleMode = () => {
    setIsSignUp(!isSignUp);
    setIsForgotPassword(false);
    reset();
    setError(null);
    setNotice(null);
  };

  const redirectByRole = (role?: string) => {
    if (role === "ADMIN") router.push("/admindashboard");
    else if (role === "TENANT") router.push("/tenantdashboard");
    else router.push("/public-view");
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err?.message || "Failed to login with Google");
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: any) => {
    setIsLoading(true);
    setError(null);
    try {
      if (isSignUp) {
        const res = await signUpAction({
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          password: data.password,
        });
        if (!res.success || !res.data) throw new Error(res.error || "Error creating account.");
        login(res.data.id, res.data.name || data.firstName, res.data.email, res.data.role);
        onClose();
        redirectByRole(res.data.role);
      } else {
        const res = await loginAction({ email: data.email, password: data.password });
        if (!res.success || !res.data) throw new Error(res.error || "Invalid email or password.");
        login(res.data.id, res.data.name, res.data.email, res.data.role, res.data.avatarUrl);
        onClose();
        redirectByRole(res.data.role);
      }
    } catch (err: any) {
      setError(err?.message || (isSignUp ? "Error creating account." : "Invalid email or password."));
    } finally {
      setIsLoading(false);
    }
  };

  const requestReset = async () => {
    const email = String(getValues("email") || "").trim();
    if (!email) {
      setError("Please enter your email first.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { requestPasswordResetAction } = await import("@/app/actions/auth");
      const res = await requestPasswordResetAction(email);
      if (res.success) {
        setNotice(res.message || "Check your email for the reset code.");
        router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
        onClose();
      } else {
        setError(res.error || "Failed to send reset email.");
      }
    } catch {
      setError("An error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] overflow-y-auto overscroll-contain">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md"
            onClick={onClose}
          />
          {/* min-h-full + items-center centres short cards and lets tall ones scroll from the top */}
          <div className="relative min-h-full flex items-center justify-center p-4 sm:p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-white/5 overflow-hidden"
          >
            <div
              className={`relative ${isSignUp ? "h-24" : "h-32"} bg-primary flex items-center justify-center overflow-hidden transition-[height]`}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
              <div className="relative z-10 flex flex-col items-center">
                <div className={`${isSignUp ? "w-11 h-11" : "w-14 h-14"} bg-white rounded-2xl overflow-hidden shadow-lg mb-2 p-0.5`}>
                  <img src="/images/srmall-logo/sr_logo2.jpg" alt="Logo" className="w-full h-full object-cover rounded-xl" />
                </div>
                <h2 className="text-white font-bold uppercase text-[10px] tracking-[0.3em]">
                  {isForgotPassword ? "Reset Password" : isSignUp ? "SR MALL" : "SR MALL LOGIN"}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute top-6 right-6 p-2 text-white/60 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className={isSignUp ? "p-6 sm:p-8" : "p-8 sm:p-10"}>
              {isSignUp && (
                <div className="mb-5 text-center">
                  <h3 className="text-lg font-black text-charcoal dark:text-white">Create your account</h3>
                  <p className="text-xs text-slate-500 mt-1">Use your Gmail address to sign up.</p>
                </div>
              )}
              <form onSubmit={handleSubmit(onSubmit)} className={isSignUp ? "space-y-4" : "space-y-6"} noValidate>
                {error && (
                  <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-500 text-xs font-bold rounded-2xl border border-red-100 dark:border-red-900/30 animate-shake">
                    <AlertCircle size={16} className="shrink-0" />
                    {error}
                  </div>
                )}
                {notice && (
                  <div className="flex items-start gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                    <CheckCircle2 size={16} className="shrink-0" />
                    {notice}
                  </div>
                )}

                <div className={isSignUp ? "space-y-3" : "space-y-4"}>
                  {isForgotPassword ? (
                    <div className="space-y-4 animate-fade-in">
                      <div className="space-y-2">
                        <label className={LABEL}>Recovery Email</label>
                        <div className="relative group">
                          <Mail size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                          <input {...register("email")} type="email" placeholder="Enter your registered email" className={`${INPUT} pl-14 pr-6 py-4`} />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={requestReset}
                        disabled={isLoading}
                        className="w-full py-4 bg-charcoal dark:bg-white dark:text-black text-white font-bold rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-2"
                      >
                        {isLoading ? <Loader2 className="animate-spin" size={18} /> : "Request Recovery Link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsForgotPassword(false)}
                        className="w-full text-xs font-bold text-slate-400 hover:text-primary transition-colors"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  ) : (
                    <>
                      {isSignUp && (
                        <div className="grid grid-cols-1 min-[380px]:grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <label className={LABEL}>First Name</label>
                            <input {...register("firstName")} type="text" placeholder="Juan" autoComplete="given-name" className={`${INPUT} px-4 py-3.5`} />
                            {errors.firstName && (
                              <span className="text-[10px] text-red-500 px-1">{errors.firstName.message?.toString()}</span>
                            )}
                          </div>
                          <div className="space-y-2">
                            <label className={LABEL}>Last Name</label>
                            <input {...register("lastName")} type="text" placeholder="Dela Cruz" autoComplete="family-name" className={`${INPUT} px-4 py-3.5`} />
                            {errors.lastName && (
                              <span className="text-[10px] text-red-500 px-1">{errors.lastName.message?.toString()}</span>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <label className={LABEL}>{isSignUp ? "Gmail Address" : "Email Address"}</label>
                        <div className="relative group">
                          <Mail size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                          <input
                            {...register("email")}
                            type="email"
                            placeholder={isSignUp ? "yourname@gmail.com" : "Enter your email"}
                            autoComplete="email"
                            className={`${INPUT} pl-14 pr-6 ${isSignUp ? "py-3.5" : "py-4"}`}
                          />
                        </div>
                        {errors.email ? (
                          <span className="text-[10px] text-red-500 px-1">{errors.email.message?.toString()}</span>
                        ) : (
                          isSignUp && (
                            <span className="text-[10px] text-slate-400 px-1">New accounts need a @gmail.com address.</span>
                          )
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Password</label>
                          {!isSignUp && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsForgotPassword(true);
                                setError(null);
                              }}
                              className="text-[10px] font-bold text-primary hover:underline"
                            >
                              Forgot Password?
                            </button>
                          )}
                        </div>
                        <div className="relative group">
                          <Lock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-primary transition-colors" />
                          <input
                            {...register("password")}
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            autoComplete={isSignUp ? "new-password" : "current-password"}
                            className={`${INPUT} pl-14 pr-12 ${isSignUp ? "py-3.5" : "py-4"}`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-primary transition-colors focus:outline-none"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {errors.password ? (
                          <span className="text-[10px] text-red-500 px-1">{errors.password.message?.toString()}</span>
                        ) : (
                          isSignUp && <span className="text-[10px] text-slate-400 px-1">At least 6 characters.</span>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full flex items-center justify-center gap-3 ${isSignUp ? "py-4 mt-1" : "py-5"} bg-primary text-white font-bold rounded-2xl hover:bg-primary-hover transition-all active:scale-95 shadow-xl shadow-primary/30 disabled:opacity-70 disabled:scale-100`}
                      >
                        {isLoading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                          <>
                            <LogIn size={18} /> {isSignUp ? "Create Account" : "Authorize Access"}
                          </>
                        )}
                      </button>
                    </>
                  )}
                </div>
              </form>

              {!isForgotPassword && (
                <>
                  <div className={`relative ${isSignUp ? "my-4" : "my-6"}`}>
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white dark:bg-zinc-900 px-2 text-slate-500 uppercase tracking-widest font-black">
                        Or Continue With
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-slate-50 dark:bg-zinc-800 border-2 border-slate-100 dark:border-white/5 rounded-2xl hover:bg-slate-100 dark:hover:bg-zinc-700 transition-all font-bold text-sm text-charcoal dark:text-white"
                  >
                    <GoogleIcon /> Google
                  </button>
                </>
              )}

              <p className={`${isSignUp ? "mt-5" : "mt-8"} text-center text-xs text-slate-500 font-medium`}>
                {isSignUp ? "Already have an account? " : "Don't have an account? "}
                <button type="button" onClick={toggleMode} className="text-primary font-bold hover:underline">
                  {isSignUp ? "Sign In" : "Sign Up"}
                </button>
              </p>
            </div>
          </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
