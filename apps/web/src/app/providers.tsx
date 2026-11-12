"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { supabase } from "@/utils/supabase";
import { signInWithGoogleAction } from "./actions/auth";

// ─── Auth Context ─────────────────────────────────────────────────────────────

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatarUrl?: string | null;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: AuthUser | null;
  login: (
    id: string,
    name: string,
    email: string,
    role?: string,
    avatarUrl?: string | null,
  ) => void;
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

// ─── Session persistence ──────────────────────────────────────────────────────
// The session is intentionally short-lived so shared/kiosk browsers do not stay
// signed in for days. Changing SESSION_VERSION logs out every existing browser
// once on its next load, then new sessions follow the TTL below.
const SESSION_KEY = "srmall_session";
const LEGACY_SESSION_KEY = "srmall_user";
const SESSION_VERSION = 2;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

type StoredSession = {
  user: AuthUser;
  expiresAt: number;
  version: number;
};

function readStoredSession(): StoredSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSession;
    const valid =
      parsed?.version === SESSION_VERSION &&
      typeof parsed.expiresAt === "number" &&
      Number.isFinite(parsed.expiresAt) &&
      parsed.expiresAt > Date.now() &&
      !!parsed.user?.id;
    if (!valid) {
      window.localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function writeStoredSession(user: AuthUser, expiresAt?: number) {
  if (typeof window === "undefined") return;
  const session: StoredSession = {
    user,
    expiresAt: expiresAt ?? Date.now() + SESSION_TTL_MS,
    version: SESSION_VERSION,
  };
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // Drop the pre-expiry key left behind by older builds.
  window.localStorage.removeItem(LEGACY_SESSION_KEY);
}

function clearStoredSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(LEGACY_SESSION_KEY);
}

export const AppProviders = ({ children }: { children: React.ReactNode }) => {
  // ── Auth state ──
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const logout = useCallback(() => {
    setIsAuthenticated(false);
    setUser(null);
    clearStoredSession();
    // End the Google/Supabase session as well (no-op if there is none).
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        supabase.auth.signOut().catch((err) => console.error("SignOut error:", err));
      }
    });
  }, []);

  const login = useCallback(
    (
      id: string,
      name: string,
      email: string,
      role?: string,
      avatarUrl?: string | null,
    ) => {
      const userData: AuthUser = { id, name, email, role, avatarUrl };
      setIsAuthenticated(true);
      setUser(userData);
      writeStoredSession(userData);
    },
    [],
  );

  const updateUser = useCallback((data: { name?: string; email?: string; avatarUrl?: string | null }) => {
    setUser((current) => {
      if (!current) return current;
      const updatedUser = { ...current, ...data };
      // Keep the original expiry when the profile changes.
      try {
        const raw = localStorage.getItem(SESSION_KEY);
        const existing = raw ? (JSON.parse(raw) as StoredSession) : null;
        const session: StoredSession = {
          user: updatedUser,
          expiresAt:
            existing?.version === SESSION_VERSION && existing.expiresAt > Date.now()
              ? existing.expiresAt
              : Date.now() + SESSION_TTL_MS,
          version: SESSION_VERSION,
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        localStorage.removeItem(LEGACY_SESSION_KEY);
      } catch {
        writeStoredSession(updatedUser);
      }
      return updatedUser;
    });
  }, []);

  // Hydrate the cached session, watch for expiry, and mirror logins/logouts
  // between tabs. Existing pre-expiry sessions are deliberately discarded.
  useEffect(() => {
    localStorage.removeItem(LEGACY_SESSION_KEY);

    const stored = readStoredSession();
    if (stored) {
      setIsAuthenticated(true);
      setUser(stored.user);
    }

    const checkExpiry = () => {
      if (!localStorage.getItem(SESSION_KEY)) return;
      if (!readStoredSession()) logout();
    };

    expiryTimerRef.current = setInterval(checkExpiry, 30_000);

    const onStorage = (event: StorageEvent) => {
      if (event.key === SESSION_KEY) {
        const next = readStoredSession();
        if (next) {
          setUser(next.user);
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      }
      if (event.key === LEGACY_SESSION_KEY) {
        localStorage.removeItem(LEGACY_SESSION_KEY);
      }
    };

    const onFocus = () => checkExpiry();
    const onVisibility = () => {
      if (document.visibilityState === "visible") checkExpiry();
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    // …then, for Google sign-ins, confirm it with the server: it verifies the
    // Supabase access token and returns the account for that Gmail address.
    // Email + password sign-ins have no Google session and keep the cached user.
    // Only a browser with a valid SR-Mall session may re-hydrate this way; this
    // keeps the expiry rule from being bypassed by Supabase's own localStorage.
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        logout();
        return;
      }
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return;
      if (!session?.access_token) return;
      const stored = readStoredSession();
      if (!stored) return;

      const res = await signInWithGoogleAction(session.access_token);
      if (res.success) {
        // Never let a lingering Google session replace a different SR-Mall
        // account signed in with email + password in this browser.
        if (
          stored.user.email?.toLowerCase() !== res.data.email?.toLowerCase()
        ) {
          return;
        }
        // Re-hydrate the profile but keep the existing expiry: loading or
        // refreshing a page must not silently extend the 8-hour session.
        const refreshedUser: AuthUser = {
          id: res.data.id,
          name: res.data.name,
          email: res.data.email,
          role: res.data.role,
          avatarUrl: res.data.avatarUrl,
        };
        setIsAuthenticated(true);
        setUser(refreshedUser);
        writeStoredSession(refreshedUser, stored.expiresAt);
      } else {
        // Google account not allowed (non-Gmail, suspended) or expired.
        logout();
      }
    });

    return () => {
      if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      data.subscription.unsubscribe();
    };
  }, [logout]);

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
