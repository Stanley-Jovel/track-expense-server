"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { correctTransactionAmount } from "./actions";
import { formatUsd } from "./format";

/**
 * An entry's signed amount, tappable to correct it in place. Saving
 * rewrites only this row's amount cell in the sheet. Enter or leaving the
 * field saves; Escape (or an unchanged value) cancels.
 */
export function EntryAmount({
  row,
  motive,
  amount,
  type,
}: {
  row: number;
  motive: string;
  amount: number;
  type: "Income" | "Expense";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Set by Escape so the blur that follows closes without saving.
  const cancelled = useRef(false);
  // The saved amount, shown until the refreshed sheet data arrives (the
  // `amount` prop changes) so the row doesn't flash back to the old value.
  const [saved, setSaved] = useState<{ from: number; to: number } | null>(null);

  const sign = type === "Income" ? "+" : "−";
  const shown = saved && saved.from === amount ? saved.to : amount;

  const open = () => {
    setError(null);
    setDraft(shown.toFixed(2));
    cancelled.current = false;
    setEditing(true);
  };

  const save = () => {
    setEditing(false);
    if (cancelled.current) return;
    const next = Number(draft.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(next) || next <= 0) {
      setError("Enter an amount greater than $0.");
      return;
    }
    if (Math.round(next * 100) === Math.round(shown * 100)) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await correctTransactionAmount(row, motive, amount, next);
        if (result.ok) {
          setSaved({ from: amount, to: result.amount });
          router.refresh();
        } else {
          setError(result.error);
        }
      } catch {
        setError("Couldn't save the amount. Try again.");
      }
    });
  };

  const color = type === "Income" ? { color: "var(--ledger-down)" } : undefined;

  return (
    <div className="shrink-0 text-right">
      {editing ? (
        <span className="text-sm tabular-nums" style={color}>
          {sign}$
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            aria-label={`Amount for ${motive}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={(e) => e.target.select()}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                cancelled.current = true;
                e.currentTarget.blur();
              }
            }}
            // 16px keeps iOS Safari from zooming in when the keyboard opens.
            className="w-20 border-b bg-transparent text-right text-base tabular-nums outline-none"
            style={{ borderColor: "var(--ledger-rule)" }}
          />
        </span>
      ) : (
        <button
          type="button"
          onClick={open}
          disabled={pending}
          aria-label={`Amount ${formatUsd(amount)}. Tap to correct.`}
          // Padding grows the tap target without moving the text.
          className="-my-2 py-2 text-sm tabular-nums underline decoration-dotted underline-offset-2"
          style={{ ...color, textDecorationColor: "var(--ledger-rule)" }}
        >
          {sign}
          {pending ? "Saving…" : formatUsd(shown)}
        </button>
      )}
      {error && (
        <p role="alert" className="mt-0.5 max-w-40 text-xs italic" style={{ color: "var(--ledger-up)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
