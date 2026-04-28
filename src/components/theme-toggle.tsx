"use client";

import { useEffect } from "react";

type ThemeMode = "light" | "dark";

function resolveCurrentTheme(): ThemeMode {
  const attrTheme = document.documentElement.getAttribute("data-theme");
  if (attrTheme === "dark" || attrTheme === "light") {
    return attrTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function ThemeToggle() {
  useEffect(() => {
    const saved = localStorage.getItem("awr-theme");
    if (saved === "dark" || saved === "light") {
      document.documentElement.setAttribute("data-theme", saved);
      return;
    }

    document.documentElement.setAttribute("data-theme", resolveCurrentTheme());
  }, []);

  function toggleTheme() {
    const currentTheme = resolveCurrentTheme();
    const nextTheme: ThemeMode = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", nextTheme);
    localStorage.setItem("awr-theme", nextTheme);
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-full border border-radar-stroke bg-radar-soft px-2.5 py-1 text-sm font-medium text-radar-ink hover:bg-radar-accent-soft"
      aria-label="Toggle dark mode"
    >
      ◐
    </button>
  );
}
