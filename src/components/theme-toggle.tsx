"use client";

import { useSyncExternalStore } from "react";

type ThemeMode = "light" | "dark";

function getTheme(): ThemeMode {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem("awr-theme");
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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