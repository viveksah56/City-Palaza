"use client";
import * as React from "react";

export function useCooldown() {
  const [seconds, setSeconds] = React.useState(0);

  React.useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((remaining) => Math.max(0, remaining - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const start = React.useCallback((value: number | string | null) => {
    const parsed = Number(value);
    setSeconds(Number.isFinite(parsed) ? Math.min(300, Math.max(0, Math.ceil(parsed))) : 0);
  }, []);

  return { seconds, start };
}

export function formatCooldown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
