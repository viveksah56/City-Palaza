"use client";

import * as React from "react";
import { SESSION_EXPIRED_LOGOUT_URL } from "@/lib/constants";

const MAX_TIMEOUT_MS = 2_147_000_000; // setTimeout overflows past ~24.8 days

/**
 * Signs the browser out the moment the login's hard expiry passes, even if the person is just staring at
 * an open page. It also re-checks when the tab becomes visible again, because timers are throttled or
 * paused in background tabs and sleeping laptops.
 */
export function SessionExpiryGuard({ expiresAt }: { expiresAt: string }) {
  React.useEffect(() => {
    const target = Date.parse(expiresAt);
    if (Number.isNaN(target)) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let leaving = false;
    const logout = () => {
      if (leaving) return;
      leaving = true;
      window.location.assign(SESSION_EXPIRED_LOGOUT_URL);
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      const remaining = target - Date.now();
      if (remaining <= 0) return logout();
      timer = setTimeout(schedule, Math.min(remaining, MAX_TIMEOUT_MS));
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") schedule();
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [expiresAt]);

  return null;
}
