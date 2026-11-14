import { useEffect, useState } from "react";
import { localRepo, STORAGE_PREFIX } from "@/lib/storage";

type Theme = "light" | "dark";
const KEY = `${STORAGE_PREFIX}theme`;

function initialTheme(): Theme {
  const saved = localRepo.get(KEY);
  if (saved === "light" || saved === "dark") return saved;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);
  const toggle = () =>
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try { localRepo.set(KEY, next); } catch { /* ignore */ }
      return next;
    });
  return { theme, toggle };
}
