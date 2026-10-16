"use client";

// PROTOTYPE: floating variant switcher for throwaway UI prototypes.
// Cycles ?variant= with the arrows or ←/→. Never rendered in production.

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function PrototypeSwitcher({
  variants,
}: {
  variants: { key: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get("variant") ?? variants[0].key;
  const index = Math.max(0, variants.findIndex((v) => v.key === current));

  const go = (delta: number) => {
    const next = variants[(index + delta + variants.length) % variants.length];
    router.replace(`${pathname}?variant=${next.key}`, { scroll: false });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;
  const v = variants[index];
  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "8px 14px",
        borderRadius: 999,
        background: "#111",
        color: "#fff",
        font: "500 13px ui-monospace, monospace",
        boxShadow: "0 6px 24px rgba(0,0,0,.35)",
        border: "2px dashed #f5c518",
      }}
    >
      <button onClick={() => go(-1)} aria-label="Previous variant" style={{ padding: "0 6px" }}>
        ←
      </button>
      <span>
        {v.key} ({v.name})
      </span>
      <button onClick={() => go(1)} aria-label="Next variant" style={{ padding: "0 6px" }}>
        →
      </button>
    </div>
  );
}
