"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogButton } from "konsta/react";
import { deleteTransaction } from "./actions";
import { formatUsd } from "./format";

// Width of the action tray revealed behind a swiped entry: two actions.
const TRAY = 176;
// How far an open entry slides: the tray plus a gap so the entry's amount
// doesn't sit flush against the Modify button.
const OPEN = TRAY + 12;

/**
 * An entry that slides left to reveal its actions (iOS-style): Modify and
 * Delete. A horizontal drag moves the entry; a vertical one is left to the
 * page so scrolling still works. Released past half the tray it stays open;
 * a tap on an open entry closes it. On desktop a mouse drag works the same,
 * and so does a two-finger horizontal swipe on a trackpad (wheel events).
 * The tray's buttons open it when they get keyboard focus, so the actions
 * are reachable without swiping.
 */
export function SwipeRow({
  open,
  onOpenChange,
  onModify,
  onDelete,
  label,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onModify: () => void;
  onDelete: () => void;
  /** Names the entry for the action buttons' accessible labels. */
  label: string;
  children: ReactNode;
}) {
  // Offset while a drag is in progress; null when resting at open/closed.
  const [drag, setDrag] = useState<number | null>(null);
  const gesture = useRef<{
    x: number;
    y: number;
    base: number;
    axis: "x" | "y" | null;
  } | null>(null);
  // Set when a gesture moved the entry, so the click that ends it doesn't
  // also land on whatever is underneath.
  const swallowClick = useRef(false);
  const container = useRef<HTMLDivElement>(null);

  const rest = open ? -OPEN : 0;
  const offset = drag ?? rest;

  // Trackpad swipes arrive as wheel events with no "end" event, so the entry
  // follows deltaX and settles once the events stop. React's onWheel is
  // passive and can't preventDefault, which is needed here to keep the
  // browser from treating the swipe as back/forward navigation. The listener
  // sits on the whole row, not the sliding entry, so the swipe keeps going
  // once the cursor ends up over the tray's buttons.
  const latest = useRef({ open, onOpenChange });
  latest.current = { open, onOpenChange };
  useEffect(() => {
    const node = container.current;
    if (!node) return;
    let wheelOffset: number | null = null;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      if (wheelOffset === null && Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      const base = wheelOffset ?? (latest.current.open ? -OPEN : 0);
      wheelOffset = Math.max(-OPEN * 1.25, Math.min(0, base - e.deltaX));
      setDrag(wheelOffset);
      clearTimeout(settle);
      settle = setTimeout(() => {
        latest.current.onOpenChange(wheelOffset! < -OPEN / 2);
        wheelOffset = null;
        setDrag(null);
      }, 120);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      node.removeEventListener("wheel", onWheel);
      clearTimeout(settle);
    };
  }, []);

  return (
    <div ref={container} className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: TRAY }}>
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onFocus={() => onOpenChange(true)}
          onClick={onModify}
          aria-label={`Modify ${label}`}
          className="flex-1 bg-[#8E8E93] text-[15px] font-medium text-white"
        >
          Modify
        </button>
        <button
          type="button"
          tabIndex={open ? 0 : -1}
          onFocus={() => onOpenChange(true)}
          onClick={onDelete}
          aria-label={`Delete ${label}`}
          className="flex-1 bg-[#FF3B30] text-[15px] font-medium text-white"
        >
          Delete
        </button>
      </div>
      <div
        // The inset list's own background, so the tray stays hidden behind it.
        className="relative bg-ios-light-surface-1 dark:bg-ios-dark-surface-1"
        style={{
          // Keep a mouse drag from selecting the entry's text.
          userSelect: drag === null ? undefined : "none",
          transform: `translateX(${offset}px)`,
          transition: drag === null ? "transform 180ms ease-out" : "none",
          touchAction: "pan-y",
          overscrollBehaviorX: "none",
        }}
        onPointerDown={(e) => {
          if (e.pointerType === "mouse" && e.button !== 0) return;
          gesture.current = { x: e.clientX, y: e.clientY, base: rest, axis: null };
          swallowClick.current = false;
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g) return;
          const dx = e.clientX - g.x;
          const dy = e.clientY - g.y;
          if (g.axis === null) {
            if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
            g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
            if (g.axis === "x") {
              e.currentTarget.setPointerCapture(e.pointerId);
              window.getSelection()?.removeAllRanges();
            }
          }
          if (g.axis !== "x") return;
          swallowClick.current = true;
          setDrag(Math.max(-OPEN * 1.25, Math.min(0, g.base + dx)));
        }}
        onPointerUp={() => {
          const g = gesture.current;
          gesture.current = null;
          if (g?.axis === "x" && drag !== null) {
            onOpenChange(drag < -OPEN / 2);
          } else if (g?.axis === null && open) {
            // A plain tap on an open entry just closes it.
            swallowClick.current = true;
            onOpenChange(false);
          }
          setDrag(null);
        }}
        onPointerCancel={() => {
          gesture.current = null;
          setDrag(null);
        }}
        onClickCapture={(e) => {
          if (swallowClick.current) {
            e.preventDefault();
            e.stopPropagation();
            swallowClick.current = false;
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The iOS alert shown after an entry's Delete action: it names the entry,
 * amount and date, because the sheet row is removed for good.
 */
export function DeleteConfirm({
  row,
  motive,
  merchant,
  amount,
  type,
  dateLabel,
  onClose,
}: {
  row: number;
  motive: string;
  merchant: string;
  amount: number;
  type: "Income" | "Expense";
  dateLabel: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const signed = `${type === "Income" ? "+" : "−"}${formatUsd(amount)}`;
  const noun = type === "Income" ? "income" : "expense";

  const remove = () => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await deleteTransaction(row, motive, amount);
        if (result.ok) {
          onClose();
          router.refresh();
        } else {
          setError(result.error);
        }
      } catch {
        setError("Couldn't delete the entry. Try again.");
      }
    });
  };

  return (
    <Dialog
      opened
      onBackdropClick={() => !pending && onClose()}
      title={`Delete this ${noun}?`}
      content={
        <div role="alertdialog" aria-label={`Delete ${merchant}?`}>
          <p>
            {merchant}, <span className="tabular-nums">{signed}</span> on {dateLabel}
          </p>
          <p className="mt-1 break-words text-xs opacity-70">
            Logged as “{motive}”. This removes the row from your Google Sheet. It
            can&apos;t be undone.
          </p>
          {error && (
            <p role="alert" className="mt-2 text-xs text-[#FF3B30]">
              {error}
            </p>
          )}
        </div>
      }
      buttons={
        <>
          <DialogButton onClick={onClose} disabled={pending}>
            Cancel
          </DialogButton>
          {/* iOS 26 destructive alert button: filled red. */}
          <DialogButton
            strong
            onClick={remove}
            disabled={pending}
            className="bg-[#FF3B30]! text-white!"
          >
            {pending ? "Deleting…" : `Delete ${signed}`}
          </DialogButton>
        </>
      }
    />
  );
}
