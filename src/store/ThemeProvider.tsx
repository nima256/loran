"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeSetting = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "loran:theme";

interface ThemeContextValue {
  /** What the user chose — may be "system". */
  theme: ThemeSetting;
  /** What is actually painted right now. */
  resolved: ResolvedTheme;
  setTheme: (theme: ThemeSetting) => void;
  /** Cycles light → dark → system, for the single-button header control. */
  cycleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}

/**
 * Runs before paint (injected in <head>) so the correct theme class is on <html>
 * on the very first frame — no flash of the wrong theme.
 */
export const themeInitScript = `
(function(){
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var setting = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    var dark = setting === "dark" || (setting === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
`;

function systemPrefersDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Start from "system" on both server and client; the init script has already
  // painted the right colours, and the first effect syncs state to storage.
  const [theme, setThemeState] = useState<ThemeSetting>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  const apply = useCallback((setting: ThemeSetting) => {
    const dark = setting === "dark" || (setting === "system" && systemPrefersDark());
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    setResolved(dark ? "dark" : "light");
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeSetting | null;
    const initial = stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
    setThemeState(initial);
    apply(initial);
  }, [apply]);

  // Follow the OS while the setting is "system".
  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme, apply]);

  const setTheme = useCallback((next: ThemeSetting) => {
    setThemeState(next);
    localStorage.setItem(STORAGE_KEY, next);
    apply(next);
  }, [apply]);

  const cycleTheme = useCallback(() => {
    setTheme(theme === "light" ? "dark" : theme === "dark" ? "system" : "light");
  }, [theme, setTheme]);

  const value = useMemo(() => ({ theme, resolved, setTheme, cycleTheme }), [theme, resolved, setTheme, cycleTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
