"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { loginAction } from "./actions/auth";

// ─── Auth Context ─────────────────────────────────────────────────────────────

interface AuthContextType {
  isAuthenticated: boolean;
  user: { id: string; name: string; email: string; role?: string; avatarUrl?: string | null } | null;
  login: (id: string, name: string, email: string, role?: string, avatarUrl?: string | null) => void;
  updateUser: (data: { name?: string; email?: string; avatarUrl?: string | null }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
  // ── Auth state ──
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<{
    id: string;
    name: string;
    email: string;
    role?: string;
    avatarUrl?: string | null;
  } | null>(null);

  // Persistence logic
  useEffect(() => {
    // Restore local session from localStorage immediately on mount to prevent logouts on refresh
    const storedUser = localStorage.getItem("srmall_user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setIsAuthenticated(true);
        setUser(parsed);

        // Re-fetch fresh user data from DB to sync avatarUrl and name in case they were updated
        // on another device or from another account. This fixes the stale avatar bug.
        loginAction({ email: parsed.email, password: "OAUTH_LOGIN_BYPASS" }).then((res) => {
          if (res.success && res.data) {
            const freshData = { id: res.data.id, name: res.data.name, email: res.data.email, role: res.data.role, avatarUrl: res.data.avatarUrl };
            setUser(freshData);
            localStorage.setItem("srmall_user", JSON.stringify(freshData));
          }
        }).catch(() => { /* silent fail - we already have cached data */ });
      } catch (err) {
        console.error("Failed to parse stored user:", err);
      }
    }

    let subscription: { unsubscribe: () => void } | null = null;

    const syncSession = async () => {
      // Automatic session recovery disabled as per user request.
      // Users must now manually log in each time the site is opened.

      // 3. Listen for auth changes
      const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user?.email) {
           const res = await loginAction({ 
             email: session.user.email, 
             password: "OAUTH_LOGIN_BYPASS" 
           });
           if (res.success && res.data) {
             login(res.data.id, res.data.name, res.data.email, res.data.role, res.data.avatarUrl);
           }
        } else if (event === 'SIGNED_OUT') {
           logout();
        }
      });
      subscription = data.subscription;
    };

    syncSession();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  const login = (id: string, name: string, email: string, role?: string, avatarUrl?: string | null) => {
    const userData = { id, name, email, role, avatarUrl };
    setIsAuthenticated(true);
    setUser(userData);
    localStorage.setItem("srmall_user", JSON.stringify(userData));
  };

  const updateUser = (data: { name?: string; email?: string; avatarUrl?: string | null }) => {
    if (user) {
      const updatedUser = { ...user, ...data };
      setUser(updatedUser);
      localStorage.setItem("srmall_user", JSON.stringify(updatedUser));
    }
  };

  const logout = () => {
    const hasUser = localStorage.getItem("srmall_user");
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem("srmall_user");
    if (hasUser) {
      supabase.auth.signOut().catch((err) => console.error("SignOut error:", err));
    }
  };

  return (
    <AuthContext.Provider
      value={{ isAuthenticated, user, login, updateUser, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useTheme = () => ({ theme: "light", toggleTheme: () => {} });

// Keep AuthProvider alias for backwards-compatibility with any existing imports
export const AuthProvider = AppProviders;
