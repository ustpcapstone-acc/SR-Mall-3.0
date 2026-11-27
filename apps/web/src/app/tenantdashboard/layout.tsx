"use client";

import { TenantSidebar } from "@/components/tenant/sidebar";
import { TenantNavbar } from "@/components/tenant/navbar";
import { useAuth } from "@/app/providers";
import React, { useState } from "react";
import Link from "next/link";
import { ResetPublicTheme } from "@/components/reset-public-theme";

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // The proxy already sent visitors without a tenant session to the sign-in page.
  // This only shows while the browser restores its copy of the session.
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50 dark:bg-[#0f1117] text-sm text-slate-500">
        <p>Loading your account...</p>
        <Link href="/login?role=tenant" className="text-primary hover:underline">
          Sign in again
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1117] font-sans selection:bg-primary selection:text-white flex">
      <ResetPublicTheme />
      <TenantNavbar onMenuClick={() => setIsMobileMenuOpen(true)} />
      <TenantSidebar
        isMobileOpen={isMobileMenuOpen}
        onMobileClose={() => setIsMobileMenuOpen(false)}
      />
      <main className="flex-1 lg:ml-72 pt-16 sm:pt-20 flex flex-col min-h-screen min-w-0 lg:w-[calc(100%-18rem)] overflow-x-hidden">
        <div className="flex-1 overflow-x-hidden">{children}</div>
      </main>
    </div>
  );
}
