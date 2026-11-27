"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LoginModal } from "@/components/login-modal";

/** Sign-in for customers and tenants, plus customer sign-up (the same form the site opens as a dialog). */
export default function LoginPage() {
  return (
    <main className="min-h-svh bg-kumo-recessed">
      <Suspense fallback={null}>
        <Login />
      </Suspense>
    </main>
  );
}

function Login() {
  const router = useRouter();
  // Only paths on this site, e.g. /account after the sign-in guard sent you here.
  const params = useSearchParams();
  const next = params.get("next");
  const nextPath = next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
  const role = params.get("role") === "tenant" ? "TENANT" : "CUSTOMER";
  return <LoginModal key={role} isOpen initialRole={role} nextPath={nextPath} onClose={() => router.push("/")} />;
}
