"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { merchantName } from "@/app/services/analytics/merchant";
import { modifyTransaction } from "./actions";

const faint = { color: "var(--ledger-faint)" };
const rule = { borderColor: "var(--ledger-rule)" };
const caption = "shrink-0 text-[11px] uppercase tracking-wider";
// 16px inputs keep iOS Safari from zooming in on focus.
const bare = "min-w-0 flex-1 bg-transparent text-right text-base outline-none";
const button = "min-h-11 flex-1 border px-3 text-sm disabled:opacity-40";

/**
 * The bottom sheet behind an entry's Modify action: edits its name (Motive),
 * Category, amount and date together; Type stays as logged. The amount is
 * the headline, the rest sit beneath it as ledger rows. When an Expense's
 * Category changes, a checkbox (on by default) also saves it as a Category
 * Override for the Merchant; unchecked, only this entry changes.
 */
export function ModifySheet({
  row,
  motive,
  merchant,
  category,
  categories,
  amount,
  type,
  date,
  onClose,
}: {
  row: number;
  motive: string;
  merchant: string;
  category: string;
  /** The Category list to choose from. */
  categories: readonly string[];
  amount: number;
  type: "Income" | "Expense";
  date: Date;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [draftMotive, setDraftMotive] = useState(motive);
  const [draftCategory, setDraftCategory] = useState(category);
  const [draftAmount, setDraftAmount] = useState(amount.toFixed(2));
  // Sheet dates are UTC wall-clock, so the calendar day is the UTC one.
  const [day, setDay] = useState(date.toISOString().slice(0, 10));
  const [allFromMerchant, setAllFromMerchant] = useState(true);

  const parsedAmount = Number(draftAmount.replace(/[$,\s]/g, ""));
  const valid =
    draftMotive.trim() !== "" &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    day !== "";
  const categoryChanged = type === "Expense" && draftCategory !== category;
  const nextMerchant = merchantName(draftMotive.trim() || motive);
  const sign = type === "Income" ? "+" : "−";

  const save = () => {
    if (!valid) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await modifyTransaction(row, motive, amount, {
          motive: draftMotive.trim(),
          category: draftCategory,
          amount: parsedAmount,
          day,
          allFromMerchant: categoryChanged && allFromMerchant,
        });
        if (result.ok) {
          onClose();
          router.refresh();
        } else {
          setError(result.error);
        }
      } catch {
        setError(`Couldn't save ${merchant}. Try again.`);
      }
    });
  };

  return (
    <Sheet open onOpenChange={(open) => !open && !pending && onClose()}>
      <SheetContent
        side="bottom"
        // Returning focus to the tray's Modify button would swipe the entry
        // open again (the tray opens on focus), so leave focus where it is.
        finalFocus={false}
        className="mx-auto max-w-2xl rounded-t-xl px-5 pb-8 pt-5"
        style={{
          background: "var(--ledger-card)",
          color: "var(--ledger-ink)",
          fontFamily: "var(--font-ledger)",
        }}
      >
        <div
          className="mx-auto -mt-2 mb-1 h-1 w-10 rounded-full"
          style={{ background: "var(--ledger-rule)" }}
        />
        <SheetTitle
          className="text-center text-xs uppercase tracking-[0.25em]"
          style={faint}
        >
          Modify {type === "Income" ? "income" : "expense"}
        </SheetTitle>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-3xl" style={faint}>
              {sign}$
            </span>
            <input
              inputMode="decimal"
              value={draftAmount}
              onChange={(e) => setDraftAmount(e.target.value)}
              aria-label="Amount"
              className="w-48 bg-transparent text-center text-5xl tabular-nums outline-none"
            />
          </div>
          <div className="border-t" style={rule}>
            <label className="flex items-center justify-between gap-4 border-b py-3" style={rule}>
              <span className={caption} style={faint}>Name</span>
              <input
                value={draftMotive}
                onChange={(e) => setDraftMotive(e.target.value)}
                className={bare}
              />
            </label>
            <label className="flex items-center justify-between gap-4 border-b py-3" style={rule}>
              <span className={caption} style={faint}>Category</span>
              <select
                value={draftCategory}
                onChange={(e) => setDraftCategory(e.target.value)}
                className={`${bare} appearance-none`}
              >
                {/* A row may hold a Category from before the current list. */}
                {!categories.some((c) => c === category) && (
                  <option value={category}>{category}</option>
                )}
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-4 border-b py-3" style={rule}>
              <span className={caption} style={faint}>Date</span>
              <input
                type="date"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className={bare}
              />
            </label>
          </div>
          {categoryChanged && (
            <label className="flex items-start gap-2 text-xs" style={faint}>
              <input
                type="checkbox"
                checked={allFromMerchant}
                onChange={(e) => setAllFromMerchant(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Use {draftCategory} for all {nextMerchant} expenses, past and
                future. Unchecked, only this entry changes.
              </span>
            </label>
          )}
          {error && (
            <p role="alert" className="text-xs italic" style={{ color: "var(--ledger-up)" }}>
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className={button}
              style={rule}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!valid || pending}
              className={button}
              style={{
                borderColor: "var(--ledger-ink)",
                background: "var(--ledger-ink)",
                color: "var(--ledger-paper)",
              }}
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
