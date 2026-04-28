"use client";

import { useSyncExternalStore } from "react";

type ThemeMode = "light" | "dark";
type LanguageMode = "de" | "en";

function getTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("awr-theme");
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getLanguage(): LanguageMode {
  if (typeof window === "undefined") return "de";
  const saved = localStorage.getItem("awr-language");
  if (saved === "en" || saved === "de") return saved;
  return "de";
}

function subscribe() {
  return () => {};
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, () => "light");

  function toggleTheme() {
    const nextTheme: ThemeMode = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("awr-theme", nextTheme);
    window.dispatchEvent(new Event("storage"));
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed top-4 right-4 z-50 flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--bg-panel)] px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "light" ? "Dark" : "Light"}
    </button>
  );
}

export function LanguageToggle() {
  const language = useSyncExternalStore(subscribe, getLanguage, () => "de");

  function toggleLanguage() {
    const nextLang: LanguageMode = language === "de" ? "en" : "de";
    localStorage.setItem("awr-language", nextLang);
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className="fixed top-4 right-20 z-50 flex items-center gap-1 rounded-full border border-[var(--line)] bg-[var(--bg-panel)] px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
      aria-label={`Switch to ${language === "de" ? "English" : "Deutsch"}`}
    >
      {language === "de" ? "EN" : "DE"}
    </button>
  );
}