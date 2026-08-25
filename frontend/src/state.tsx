import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { api, type User } from "./lib/api";
import { supabase } from "./lib/supabase";

/* ── Session ─────────────────────────────────────────────────────────── */

type SessionValue = {
  user: User | null;
  ready: boolean;
  signIn: (res: { access_token: string; user: User }) => void;
  signOut: () => void;
  refresh: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session) {
        try {
          const me = await api.me();
          setUser(me);
        } catch {
          setUser(null);
        }
        setReady(true);
        return;
      }
      try {
        const me = await api.me();
        setUser(me);
      } catch {
        setUser(null);
      }
      setReady(true);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setUser(null);
        setReady(true);
        return;
      }
      try {
        const me = await api.me();
        setUser(me);
      } catch {
        setUser(null);
      }
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (res: { access_token: string; user: User }) => {
    setUser(res.user);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, signOut, refresh }),
    [user, ready, signIn, signOut, refresh],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}

/* ── Theme ───────────────────────────────────────────────────────────── */

export type ThemeChoice = "dark" | "light" | "system";

type ThemeValue = {
  choice: ThemeChoice;
  resolved: "dark" | "light";
  setChoice: (c: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);
const THEME_KEY = "fuellink.theme";

function systemTheme(): "dark" | "light" {
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>(
    () => (localStorage.getItem(THEME_KEY) as ThemeChoice | null) ?? "dark",
  );
  const [system, setSystem] = useState<"dark" | "light">(systemTheme);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const handler = () => setSystem(systemTheme());
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const resolved = choice === "system" ? system : choice;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", resolved === "light" ? "#f2f5f2" : "#0b1416");
  }, [resolved]);

  const setChoice = useCallback((next: ThemeChoice) => {
    setChoiceState(next);
    localStorage.setItem(THEME_KEY, next);
  }, []);

  const value = useMemo(() => ({ choice, resolved, setChoice }), [choice, resolved, setChoice]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

/* ── Toast ───────────────────────────────────────────────────────────── */

type ToastValue = { notify: (message: string, tone?: "info" | "error") => void };
const ToastContext = createContext<ToastValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);

  const notify = useCallback((message: string, tone: "info" | "error" = "info") => {
    setToast({ message, tone });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div
          className={`toast${toast.tone === "error" ? " toast--error" : ""}`}
          role="status"
          onClick={() => setToast(null)}
        >
          {toast.message}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
