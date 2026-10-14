"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteTransaction } from "./actions";
import { formatUsd } from "./format";

/**
 * The panel under an entry whose name was tapped: the full Motive and a
 * Delete button. Deleting takes a second, explicit confirmation that names
 * the entry, because it removes the row from the sheet for good.
 */
export function EntryActions({
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
  const [confirming, setConfirming] = useState(false);
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

  const button =
    "min-h-11 flex-1 border px-3 text-sm disabled:opacity-60";

  return (
    <div
      className="mb-2.5 border px-3 py-3 text-sm"
      style={{ borderColor: "var(--ledger-rule)", background: "var(--ledger-card)" }}
    >
      {!confirming ? (
        <div className="flex flex-col gap-3">
          <p className="break-words text-xs" style={{ color: "var(--ledger-faint)" }}>
            Logged as “{motive}”
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className={button}
              style={{ borderColor: "var(--ledger-rule)" }}
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className={button}
              style={{ borderColor: "var(--ledger-up)", color: "var(--ledger-up)" }}
            >
              Delete {noun}…
            </button>
          </div>
        </div>
      ) : (
        <div role="alertdialog" aria-label={`Delete ${merchant}?`} className="flex flex-col gap-3">
          <div>
            <p className="font-semibold">Delete this {noun}?</p>
            <p className="mt-1">
              {merchant}, <span className="tabular-nums">{signed}</span> on {dateLabel}
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--ledger-faint)" }}>
              This removes the row from your Google Sheet. It can&apos;t be undone.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              autoFocus
              onClick={() => setConfirming(false)}
              disabled={pending}
              className={button}
              style={{ borderColor: "var(--ledger-rule)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className={button}
              style={{
                borderColor: "var(--ledger-up)",
                background: "var(--ledger-up)",
                color: "var(--ledger-card)",
              }}
            >
              {pending ? "Deleting…" : `Delete ${signed}`}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs italic" style={{ color: "var(--ledger-up)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
