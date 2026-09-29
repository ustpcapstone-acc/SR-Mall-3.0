"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/utils/supabase";
import { signInWithGoogleAction } from "./actions/auth";

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
    // Show the cached user immediately so a refresh doesn't flash "logged out"…
    const storedUser = localStorage.getItem("srmall_user");
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setIsAuthenticated(true);
        setUser(parsed);
      } catch (err) {
        console.error("Failed to parse stored user:", err);
      }
    }

    // …then, for Google sign-ins, confirm it with the server: it verifies the
    // Supabase access token and returns the account for that Gmail address.
    // Email + password sign-ins have no Google session and keep the cached user.
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        logout();
        return;
      }
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return;
      if (!session?.access_token) return;

      const res = await signInWithGoogleAction(session.access_token);
      if (res.success) {
        login(res.data.id, res.data.name, res.data.email, res.data.role, res.data.avatarUrl);
      } else {
        // Google account not allowed (non-Gmail, suspended) or expired.
        logout();
      }
    });

    return () => data.subscription.unsubscribe();
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
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem("srmall_user");
    // End the Google/Supabase session as well (no-op if there is none).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        supabase.auth.signOut().catch((err) => console.error("SignOut error:", err));
      }
    });
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
