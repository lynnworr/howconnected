"use client";

import { useEffect, useState } from "react";
import {
  nextPublicTheme,
  persistPublicTheme,
  readPublicTheme,
  resolvePublicTheme,
  type PublicTheme,
} from "@/lib/theme-preference";

function applyTheme(theme: PublicTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function storedTheme(): PublicTheme | null {
  try {
    return readPublicTheme(window.localStorage);
  } catch {
    return null;
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<PublicTheme>("light");

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const active = resolvePublicTheme(
      storedTheme(),
      media.matches,
    );
    applyTheme(active);
    const frame = window.requestAnimationFrame(() => setTheme(active));

    function followSystemTheme(event: MediaQueryListEvent) {
      if (storedTheme() !== null) return;
      const next = event.matches ? "dark" : "light";
      setTheme(next);
      applyTheme(next);
    }

    media.addEventListener("change", followSystemTheme);
    return () => {
      window.cancelAnimationFrame(frame);
      media.removeEventListener("change", followSystemTheme);
    };
  }, []);

  function toggleTheme() {
    const next = nextPublicTheme(theme);
    setTheme(next);
    applyTheme(next);
    try {
      persistPublicTheme(window.localStorage, next);
    } catch {
      // The theme remains active for this page when storage is unavailable.
    }
  }

  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-pressed={dark}
      aria-label="Toggle color theme"
      title="Toggle color theme"
      className="hc-theme-toggle inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-xs font-bold transition hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff6846]"
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="hc-theme-icon-moon size-4" fill="none">
        <path d="M20.4 15.1A8.5 8.5 0 0 1 8.9 3.6 8.5 8.5 0 1 0 20.4 15.1Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
      <svg aria-hidden="true" viewBox="0 0 24 24" className="hc-theme-icon-sun hidden size-4" fill="none">
        <circle cx="12" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <span className="hc-theme-label-dark hidden sm:inline">Dark</span>
      <span className="hc-theme-label-light hidden">Light</span>
    </button>
  );
}
