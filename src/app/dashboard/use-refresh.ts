"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshDashboard } from "./actions";

/**
 * Refresh for the navbar: busts the sheet/ISR caches and re-renders with
 * fresh rows. Also reports how old the rendered data is ("Updated 2m ago"),
 * or null until mounted so server and client HTML match.
 */
export function useRefresh(fetchedAt: number) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const age = useAgeSeconds(fetchedAt);

  const refresh = () =>
    startTransition(async () => {
      await refreshDashboard();
      router.refresh();
    });

  return {
    refresh,
    pending,
    updated: pending ? "Refreshing…" : age === null ? null : `Updated ${formatAge(age)}`,
  };
}

// Seconds since the page was rendered on the server. Returns null until
// mounted so server and client HTML match.
function useAgeSeconds(fetchedAt: number): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(id);
  }, []);
  return now === null ? null : Math.max(0, Math.floor((now - fetchedAt) / 1000));
}

function formatAge(seconds: number): string {
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}
