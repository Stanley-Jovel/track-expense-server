"use client";

// PROTOTYPE — three variants of the dashboard cache-refresh affordance,
// switchable via `?variant=` on the existing /dashboard route:
//   A "Status bar"   — always-visible "Updated Xm ago · Refresh" row above the page
//   B "Floating button" — fixed bottom-right refresh FAB with a freshness dot
//   C "Stale banner" — invisible while fresh; amber banner appears once data
//                      is older than 60s, with the refresh inline
// Throwaway code: no tests, minimal error handling. The switcher bar at the
// bottom is dev-only and not part of the design being evaluated.

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refreshDashboardData } from "./actions";

const VARIANTS = [
  { key: "A", name: "Status bar" },
  { key: "B", name: "Floating button" },
  { key: "C", name: "Stale banner" },
] as const;

type VariantKey = (typeof VARIANTS)[number]["key"];

export function PrototypeRefresh({ fetchedAt }: { fetchedAt: number }) {
  const searchParams = useSearchParams();
  const raw = searchParams.get("variant");
  const variant: VariantKey =
    raw === "B" ? "B" : raw === "C" ? "C" : "A";

  return (
    <>
      {variant === "A" && <VariantStatusBar fetchedAt={fetchedAt} />}
      {variant === "B" && <VariantFab fetchedAt={fetchedAt} />}
      {variant === "C" && <VariantStaleBanner fetchedAt={fetchedAt} />}
      <PrototypeSwitcher current={variant} />
    </>
  );
}

/* ----------------------------- shared helpers ---------------------------- */

function useRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = () =>
    startTransition(async () => {
      await refreshDashboardData();
      router.refresh();
    });
  return { pending, refresh };
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

/* ------------------------- Variant A: status bar -------------------------- */

function VariantStatusBar({ fetchedAt }: { fetchedAt: number }) {
  const { pending, refresh } = useRefresh();
  const age = useAgeSeconds(fetchedAt);

  return (
    <div className="mx-auto -mb-2 flex max-w-5xl items-center justify-between gap-2 px-4 pt-4 sm:px-6">
      <p className="text-xs text-muted-foreground">
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

/* ---------------------- Variant B: floating button ------------------------ */

function VariantFab({ fetchedAt }: { fetchedAt: number }) {
  const { pending, refresh } = useRefresh();
  const age = useAgeSeconds(fetchedAt);
  const stale = age !== null && age > 60;

  return (
    <div className="fixed bottom-20 right-4 z-40 sm:bottom-6 sm:right-6">
      <Button
        size="icon"
        aria-label="Refresh data"
        onClick={refresh}
        disabled={pending}
        className="relative h-12 w-12 rounded-full shadow-lg"
      >
        <RefreshCw className={`h-5 w-5 ${pending ? "animate-spin" : ""}`} />
        {/* freshness dot: green under 60s, amber once stale */}
        <span
          className={`absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background ${
            stale ? "bg-amber-500" : "bg-emerald-500"
          }`}
        />
      </Button>
    </div>
  );
}

/* ----------------------- Variant C: stale banner -------------------------- */

function VariantStaleBanner({ fetchedAt }: { fetchedAt: number }) {
  const { pending, refresh } = useRefresh();
  const age = useAgeSeconds(fetchedAt);
  const stale = age !== null && age > 60;

  return (
    <div className="mx-auto -mb-2 max-w-5xl px-4 pt-4 sm:px-6">
      {stale ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-700 dark:bg-amber-950">
          <div className="flex min-w-0 items-center gap-2">
            <TriangleAlert className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="truncate text-xs text-amber-800 dark:text-amber-200">
              This data is {age !== null ? formatAge(age).replace(" ago", " old") : "stale"} — recent
              expenses may be missing.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={pending}
            className="h-7 shrink-0 gap-1.5 border-amber-300 px-2.5 text-xs dark:border-amber-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${pending ? "animate-spin" : ""}`} />
            {pending ? "Refreshing…" : "Refresh now"}
          </Button>
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          {age === null ? " " : "Data is up to date"}
        </p>
      )}
    </div>
  );
}

/* --------------------------- prototype switcher --------------------------- */

function PrototypeSwitcher({ current }: { current: VariantKey }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const index = VARIANTS.findIndex((v) => v.key === current);
  const go = (dir: 1 | -1) => {
    const next = VARIANTS[(index + dir + VARIANTS.length) % VARIANTS.length];
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", next.key);
    router.replace(`?${params.toString()}`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (
        el instanceof HTMLElement &&
        (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)
      )
        return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, searchParams]);

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-zinc-900 px-2 py-1 text-zinc-100 shadow-xl ring-1 ring-zinc-700">
      <button
        aria-label="Previous variant"
        onClick={() => go(-1)}
        className="rounded-full p-1 hover:bg-zinc-700"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="min-w-[150px] text-center text-xs font-medium">
        {current} · {VARIANTS[index].name}
      </span>
      <button
        aria-label="Next variant"
        onClick={() => go(1)}
        className="rounded-full p-1 hover:bg-zinc-700"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
