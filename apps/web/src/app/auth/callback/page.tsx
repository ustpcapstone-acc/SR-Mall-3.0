"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/utils/supabase";
import { loginAction } from "@/app/actions/auth";
import { useAuth } from "@/app/providers";

function AuthCallbackPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get("code");
        let session = null;

        if (code) {
          // Explicit PKCE flow
          const { data, error: authError } = await supabase.auth.exchangeCodeForSession(code);
          if (authError) throw authError;
          session = data?.session;
        } else if (typeof window !== "undefined" && window.location.hash.includes("access_token")) {
          // Implicit flow (hash fragment)
          // Give Supabase a moment to parse the hash into the local session
          for (let i = 0; i < 15; i++) {
            const { data } = await supabase.auth.getSession();
            if (data?.session) {
              session = data.session;
              break;
            }
            await new Promise((r) => setTimeout(r, 200));
          }
        } else {
          // No auth data in URL, redirect silently
          router.push("/public-view");
          return;
        }

        const email = session?.user?.email;
        if (!email) {
          throw new Error("No email returned from auth provider");
        }

        // Call loginAction to fetch or create user in Prisma DB
        const res = await loginAction({
          email,
          password: "OAUTH_LOGIN_BYPASS",
        });

        if (!res.success || !res.data) {
          throw new Error(res.error || "Failed to sync user data");
        }

        // Log the user into the local React context
        login(res.data.id, res.data.name, res.data.email, res.data.role);

        // Redirect based on role
        if (email === "jerickaradilla76@gmail.com" || res.data.role === "ADMIN") {
          router.push("/admindashboard/tenant-monitoring");
        } else if (res.data.role === "TENANT") {
          router.push("/tenantdashboard");
        } else {
          router.push("/public-view");
        }
      } catch (err: any) {
        console.error("Auth Callback Error:", err);
        setError(err?.message || "An unexpected error occurred");
        setTimeout(() => router.push("/public-view"), 4000);
      }
    };

    handleCallback();
  }, [searchParams, router, login]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black flex flex-col items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 shadow-xl rounded-2xl p-8 max-w-md w-full border border-slate-100 dark:border-zinc-800 text-center">
        {error ? (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto text-red-600 dark:text-red-400">
              ⚠️
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              Authentication Error
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {error}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Redirecting you to the home page...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Completing Sign In
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Please wait while we secure your session and redirect you.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-black flex flex-col items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 shadow-xl rounded-2xl p-8 max-w-md w-full border border-slate-100 dark:border-zinc-800 text-center">
          <div className="space-y-6">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
                Loading Auth Session
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Synchronizing your secure connection...
              </p>
            </div>
          </div>
        </div>
      </div>
    }>
      <AuthCallbackPageContent />
    </Suspense>
  );
}

