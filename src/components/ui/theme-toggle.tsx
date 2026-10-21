"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type Theme = "light" | "dark";

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem("citypalaza-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function setTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try { localStorage.setItem("citypalaza-theme", theme); } catch {}
}

export function ThemeToggle() {
  const [theme, setCurrentTheme] = React.useState<Theme>("light");

  React.useEffect(() => {
    const saved = (() => {
      try { return localStorage.getItem("citypalaza-theme"); } catch { return null; }
    })();
    setCurrentTheme(readTheme());
    if (!saved || saved === "system") {
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      const sync = () => setCurrentTheme(media.matches ? "dark" : "light");
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
  }, []);

  const nextTheme: Theme = theme === "dark" ? "light" : "dark";
  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Switch to ${nextTheme} theme`}
          onClick={() => {
            setCurrentTheme(nextTheme);
            setTheme(nextTheme);
          }}
        >
          <Icon aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Switch to {nextTheme} theme</TooltipContent>
    </Tooltip>
  );
}
