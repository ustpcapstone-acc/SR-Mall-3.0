"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button, Input, Tabs } from "@cloudflare/kumo";
import { X } from "@phosphor-icons/react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/providers";
import { loginAction, signUpAction } from "@/app/actions/auth";
import { supabase } from "@/utils/supabase";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { rememberGooglePortal } from "@/lib/google-portal";

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

// A tenant password only has to be filled in; the server decides if it is right.
const tenantSignInSchema = loginSchema.extend({ password: z.string().min(1, "Enter your password") });

/** The two public sign-ins. Staff have their own page (/staff-portal). */
export type LoginRole = "CUSTOMER" | "TENANT";

const ROLE_TABS = [
  { value: "CUSTOMER", label: "Customer", className: "flex-1 justify-center" },
  { value: "TENANT", label: "Tenant", className: "flex-1 justify-center" },
];

const isInside = (path: string, area: string) => path === area || path.startsWith(area + "/") || path.startsWith(area + "?");

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Where to go after signing in. Without it a customer stays on the current page. */
  nextPath?: string | null;
  /** Which side of the role switcher is selected at first. */
  initialRole?: LoginRole;
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

export const LoginModal = ({ isOpen, onClose, nextPath, initialRole = "CUSTOMER" }: LoginModalProps) => {
  const { login } = useAuth();
  const [role, setRole] = useState<LoginRole>(initialRole);
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
    clearErrors,
  } = useForm<any>({
    resolver: zodResolver(isSignUp ? signUpSchema : role === "TENANT" ? tenantSignInSchema : loginSchema),
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

  const pathname = usePathname();

  // Customers and tenants both sign in here; the switcher says which.
  // Return to the page that sent the visitor here, but only if the chosen role can open it.
  const next =
    nextPath &&
    (role === "TENANT"
      ? isInside(nextPath, "/tenantdashboard")
      : !isInside(nextPath, "/tenantdashboard") && !isInside(nextPath, "/admindashboard"))
      ? nextPath
      : null;

  const switchRole = (value: string) => {
    setRole(value as LoginRole);
    if (value === "TENANT") setIsSignUp(false); // Only customers sign up here.
    clearErrors();
    setError(null);
    setNotice(null);
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Google leaves the site, so note where to come back to.
      const here = pathname === "/login" ? null : window.location.pathname + window.location.search;
      rememberGooglePortal(role, next || (role === "CUSTOMER" ? here : null));
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
        // Closing leaves a customer on their page (on /login it goes home).
        onClose();
        if (next) router.push(next);
      } else {
        const res = await loginAction({ email: data.email, password: data.password }, role);
        if (!res.success || !res.data) throw new Error(res.error || "Invalid email or password.");
        login(res.data.id, res.data.name, res.data.email, res.data.role, res.data.avatarUrl);
        onClose();
        // Tenants go to their dashboard.
        const destination = next || (role === "TENANT" ? res.redirectTo : null);
        if (destination) router.push(destination);
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
        // Close first: on /login closing goes home, and the last navigation wins.
        onClose();
        router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`);
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

  const title = isForgotPassword ? "Reset your password" : isSignUp ? "Create your account" : "Sign in";
  const help = isForgotPassword
    ? "We'll email you a code."
    : isSignUp
      ? "Use your Gmail address to sign up."
      : role === "TENANT"
        ? "Manage your spaces, storefront and payments."
        : "Welcome back to SR Mall.";
  const fieldError = (message: unknown) =>
    message ? (
      <p role="alert" className="text-sm text-kumo-danger">
        {String(message)}
      </p>
    ) : null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100 overflow-y-auto overscroll-contain">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          {/* min-h-full + items-center centres short cards and lets tall ones scroll from the top */}
          <div className="relative flex min-h-full items-center justify-center p-4 sm:p-6" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="login-title"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md rounded-2xl border border-kumo-line bg-kumo-base p-6 shadow-2xl sm:p-8"
            >
              <div className="absolute right-3 top-3">
                <Button type="button" variant="ghost" shape="square" icon={<X />} aria-label="Close" onClick={onClose} />
              </div>

              <div className="mb-5 flex items-center gap-3 pr-10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/srmall-logo/sr_logo2.jpg" alt="SR Mall" className="size-12 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0">
                  <h2 id="login-title" className="font-display text-2xl font-semibold tracking-tight text-kumo-default">
                    {title}
                  </h2>
                  <p className="text-sm text-kumo-subtle">{help}</p>
                </div>
              </div>

              {!isForgotPassword && (
                <div role="group" aria-label="Sign in as" className="mb-5">
                  <Tabs variant="segmented" tabs={ROLE_TABS} value={role} onValueChange={switchRole} className="w-full" listClassName="w-full" />
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                {error && (
                  <p role="alert" className="rounded-lg bg-kumo-danger-tint p-3 text-sm font-medium text-kumo-danger">
                    {error}
                  </p>
                )}
                {notice && <p className="rounded-lg bg-kumo-success-tint p-3 text-sm font-medium text-kumo-success">{notice}</p>}

                {isForgotPassword ? (
                  <div className="space-y-3">
                    <Input
                      {...register("email")}
                      type="email"
                      label="Recovery email"
                      placeholder="Enter your registered email"
                      autoComplete="email"
                      className="w-full"
                    />
                    <Button type="button" variant="primary" size="lg" className="w-full justify-center" loading={isLoading} disabled={isLoading} onClick={requestReset}>
                      Request Recovery Link
                    </Button>
                    <Button type="button" variant="ghost" className="w-full justify-center" onClick={() => setIsForgotPassword(false)}>
                      Back to Sign In
                    </Button>
                  </div>
                ) : (
                  <>
                    {isSignUp && (
                      <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
                        <div className="space-y-1">
                          <Input {...register("firstName")} type="text" label="First name" placeholder="Juan" autoComplete="given-name" className="w-full" />
                          {fieldError(errors.firstName?.message)}
                        </div>
                        <div className="space-y-1">
                          <Input {...register("lastName")} type="text" label="Last name" placeholder="Dela Cruz" autoComplete="family-name" className="w-full" />
                          {fieldError(errors.lastName?.message)}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <Input
                        {...register("email")}
                        type="email"
                        label={isSignUp ? "Gmail address" : "Email address"}
                        aria-invalid={!!errors.email}
                        placeholder={isSignUp ? "yourname@gmail.com" : "Enter your email"}
                        autoComplete="email"
                        className="w-full"
                      />
                      {errors.email
                        ? fieldError(errors.email.message)
                        : isSignUp && <p className="text-sm text-kumo-subtle">New accounts need a @gmail.com address.</p>}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-kumo-default">Password</span>
                        <span className="flex gap-4">
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="cursor-pointer text-sm font-medium text-kumo-subtle hover:text-kumo-default"
                          >
                            {showPassword ? "Hide password" : "Show password"}
                          </button>
                          {!isSignUp && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsForgotPassword(true);
                                setError(null);
                              }}
                              className="cursor-pointer text-sm font-semibold text-primary hover:underline"
                            >
                              Forgot Password?
                            </button>
                          )}
                        </span>
                      </div>
                      <Input
                        {...register("password")}
                        type={showPassword ? "text" : "password"}
                        aria-label="Password"
                        aria-invalid={!!errors.password}
                        autoComplete={isSignUp ? "new-password" : "current-password"}
                        className="w-full"
                      />
                      {errors.password
                        ? fieldError(errors.password.message)
                        : isSignUp && <p className="text-sm text-kumo-subtle">At least 6 characters.</p>}
                    </div>

                    <Button type="submit" variant="primary" size="lg" className="w-full justify-center" loading={isLoading} disabled={isLoading}>
                      {isSignUp ? "Create Account" : "Sign In"}
                    </Button>
                  </>
                )}
              </form>

              {!isForgotPassword && (
                <>
                  <div className="my-4 flex items-center gap-3" role="separator">
                    <span className="h-px flex-1 bg-kumo-line" />
                    <span className="text-sm text-kumo-subtle">or</span>
                    <span className="h-px flex-1 bg-kumo-line" />
                  </div>
                  <Button type="button" variant="secondary" size="lg" className="w-full justify-center" icon={<GoogleIcon />} disabled={isLoading} onClick={handleGoogleLogin}>
                    Continue with Google
                  </Button>
                </>
              )}

              {role === "TENANT" ? (
                <p className="mt-5 text-center text-sm text-kumo-subtle">
                  Want to rent a space?{" "}
                  <Link href="/become-a-tenant" onClick={onClose} className="font-semibold text-primary hover:underline">
                    Become a tenant
                  </Link>
                </p>
              ) : (
                <p className="mt-5 text-center text-sm text-kumo-subtle">
                  {isSignUp ? "Already have an account? " : "Don't have an account? "}
                  <button type="button" onClick={toggleMode} className="cursor-pointer font-semibold text-primary hover:underline">
                    {isSignUp ? "Sign In" : "Sign Up"}
                  </button>
                </p>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
