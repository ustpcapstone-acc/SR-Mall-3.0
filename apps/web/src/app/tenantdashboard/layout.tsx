"use client";

import { TenantSidebar } from "@/components/tenant/sidebar";
import { TenantNavbar } from "@/components/tenant/navbar";
import { useAuth } from "@/app/providers";
import { LoginModal } from "@/components/login-modal";
import React, { useState } from "react";
import { Lock, LogIn } from "lucide-react";

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, user } = useAuth();
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4 sm:p-8">
        <div className="max-w-md w-full text-center space-y-6 sm:space-y-8 animate-fade-in-up">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-primary/10 rounded-[2.5rem] flex items-center justify-center text-primary mx-auto border border-primary/20 rotate-3">
            <Lock size={40} className="sm:w-12 sm:h-12" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter italic">
            Terminal Locked
          </h1>
          <p className="text-slate-500 font-medium px-4">
            Authentication is required to access the Business Management suite.
          </p>
          <button
            onClick={() => setIsLoginOpen(true)}
            className="w-full py-4 sm:py-5 bg-primary text-white rounded-3xl font-black uppercase tracking-widest flex items-center justify-center gap-4 hover:scale-105 transition-all shadow-xl shadow-primary/30"
          >
            <LogIn size={20} /> Authorize Session
          </button>
          <LoginModal
            isOpen={isLoginOpen}
            onClose={() => setIsLoginOpen(false)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1117] font-sans selection:bg-primary selection:text-white flex">
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
