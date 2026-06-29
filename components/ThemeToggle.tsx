"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type ThemePref = "auto" | "light" | "dark";

const STORAGE_KEY = "hbm-theme-pref";

const ORDER: ThemePref[] = ["auto", "light", "dark"];

const ICONS: Record<ThemePref, typeof Monitor> = {
  auto: Monitor,
  light: Sun,
  dark: Moon
};

const NEXT_LABEL: Record<ThemePref, string> = {
  auto: "Light",
  light: "Dark",
  dark: "Auto"
};

function resolveTheme(pref: ThemePref): "dark" | "light" {
  if (pref === "auto") {
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return pref;
}

function applyPref(pref: ThemePref) {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    /* ignore storage failures */
  }
  document.documentElement.dataset.theme = resolveTheme(pref);
}

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref | null>(null);

  useEffect(() => {
    let stored: ThemePref = "auto";
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === "auto" || raw === "light" || raw === "dark") stored = raw;
    } catch {
      /* ignore */
    }
    setPref(stored);
    applyPref(stored);

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      setPref((current) => {
        if (current === "auto") applyPref("auto");
        return current;
      });
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  function cycle() {
    setPref((current) => {
      const next = ORDER[(ORDER.indexOf(current ?? "auto") + 1) % ORDER.length];
      applyPref(next);
      return next;
    });
  }

  const Icon = pref ? ICONS[pref] : Monitor;
  const label = pref ? `${pref[0].toUpperCase()}${pref.slice(1)}` : "Auto";

  return (
    <button
      type="button"
      className="icon-button"
      aria-label={`Color theme: ${label}. Click for ${pref ? NEXT_LABEL[pref] : "Light"}`}
      title={`Theme: ${label} · click for ${pref ? NEXT_LABEL[pref] : "Light"}`}
      onClick={cycle}
      disabled={pref === null}
    >
      <Icon aria-hidden="true" size={16} />
    </button>
  );
}
