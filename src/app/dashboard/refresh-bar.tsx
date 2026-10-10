"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshDashboard } from "./actions";

/**
 * Slim bar above the dashboard: shows how old the rendered data is and a
 * button that busts the sheet/ISR caches and re-renders with fresh rows.
 */
export function RefreshBar({ fetchedAt }: { fetchedAt: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const age = useAgeSeconds(fetchedAt);

  const refresh = () =>
    startTransition(async () => {
      await refreshDashboard();
      router.refresh();
    });

  return (
    <div className="mx-auto -mb-2 flex max-w-5xl items-center justify-between gap-2 px-4 pt-4 sm:px-6">
      <p className="text-xs text-muted-foreground">
        {/* non-breaking space keeps the row height stable pre-mount */}
        {age === null ? " " : `Updated ${formatAge(age)}`}
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={refresh}
        disabled={pending}
        className="h-7 gap-1.5 px-2.5 text-xs"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
        {pending ? "Refreshing…" : "Refresh"}
      </Button>
    </div>
  );
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
