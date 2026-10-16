"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { merchantName } from "@/app/services/analytics/merchant";
import { addTransaction, modifyTransaction } from "./actions";

const faint = { color: "var(--ledger-faint)" };
const rule = { borderColor: "var(--ledger-rule)" };
const caption = "shrink-0 text-[11px] uppercase tracking-wider";
// 16px inputs keep iOS Safari from zooming in on focus.
const bare = "min-w-0 flex-1 bg-transparent text-right text-base outline-none";
const button = "min-h-11 flex-1 border px-3 text-sm disabled:opacity-40";

/** What add mode reports once an entry is saved, so the list can find it. */
export type AddedEntry = {
  type: "Income" | "Expense";
  motive: string;
  amount: number;
};

type ModifyProps = {
  mode?: "modify";
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
};

type AddProps = {
  mode: "add";
  categories: readonly string[];
  onAdded: (entry: AddedEntry) => void;
  onClose: () => void;
};

// Today's calendar day where the user is.
function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * The Entry sheet. In modify mode it's the bottom sheet behind an entry's
 * Modify action: edits its name (Motive),
 * Category, amount and date together; Type stays as logged. The amount is
 * the headline, the rest sit beneath it as ledger rows. When an Expense's
 * Category changes, a checkbox (on by default) also saves it as a Category
 * Override for the Merchant; unchecked, only this entry changes.
 *
 * In add mode (Add Entry) the same sheet starts empty, with an
 * Expense/Income toggle and the day defaulting to today; future days are
 * refused. Category is optional: left blank, one is chosen on save (see
 * addTransaction). No Category Override checkbox.
 */
export function EntrySheet(props: ModifyProps | AddProps) {
  const adding = props.mode === "add";
  const { categories, onClose } = props;
  const row = adding ? 0 : props.row;
  const motive = adding ? "" : props.motive;
  const merchant = adding ? "" : props.merchant;
  const category = adding ? "" : props.category;
  const amount = adding ? 0 : props.amount;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<"Income" | "Expense">(adding ? "Expense" : props.type);
  const [draftMotive, setDraftMotive] = useState(motive);
  const [draftCategory, setDraftCategory] = useState(category);
  const [draftAmount, setDraftAmount] = useState(adding ? "" : amount.toFixed(2));
  // Sheet dates are UTC wall-clock, so the calendar day is the UTC one.
  const [day, setDay] = useState(adding ? localToday() : props.date.toISOString().slice(0, 10));
  const [allFromMerchant, setAllFromMerchant] = useState(true);

  const parsedAmount = Number(draftAmount.replace(/[$,\s]/g, ""));
  const valid =
    draftMotive.trim() !== "" &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0 &&
    day !== "" &&
    // In add mode a blank Category is fine: it's guessed on save.
    (!adding || day <= localToday());
  const categoryChanged = !adding && type === "Expense" && draftCategory !== category;
  const nextMerchant = merchantName(draftMotive.trim() || motive);
  const sign = type === "Income" ? "+" : "−";

  const switchType = (next: "Income" | "Expense") => {
    if (next === type) return;
    setType(next);
    // Income files under Income (still changeable); back to Expense clears it
    // so an Expense can't be saved as Income by accident.
    setDraftCategory(next === "Income" && categories.includes("Income") ? "Income" : "");
  };

  const save = () => {
    if (!valid) return;
    setError(null);
    startTransition(async () => {
      if (adding) {
        try {
          const entry = { type, motive: draftMotive.trim(), amount: parsedAmount };
          const result = await addTransaction({ ...entry, day, category: draftCategory });
          if (result.ok) {
            onClose();
            props.onAdded({ ...entry, amount: Math.round(parsedAmount * 100) / 100 });
            router.refresh();
          } else {
            setError(result.error);
          }
        } catch {
          setError("Couldn't add the entry. Try again.");
        }
        return;
      }
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
        finalFocus={adding ? undefined : false}
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
          {adding ? "Add" : "Modify"} {type === "Income" ? "income" : "expense"}
        </SheetTitle>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {adding && (
            <div
              role="radiogroup"
              aria-label="Type"
              className="mx-auto mt-1 flex border text-xs uppercase tracking-wider"
              style={rule}
            >
              {(["Expense", "Income"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={type === t}
                  onClick={() => switchType(t)}
                  className="min-h-9 px-4"
                  style={
                    type === t
                      ? { background: "var(--ledger-ink)", color: "var(--ledger-paper)" }
                      : faint
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-3xl" style={faint}>
              {sign}$
            </span>
            <input
              inputMode="decimal"
              value={draftAmount}
              onChange={(e) => setDraftAmount(e.target.value)}
              placeholder="0.00"
              autoFocus={adding}
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
                placeholder={adding ? "Where or what" : undefined}
                className={bare}
              />
            </label>
            <label className="flex items-center justify-between gap-4 border-b py-3" style={rule}>
              <span className={caption} style={faint}>
                Category
                {adding && <span className="block normal-case tracking-normal italic">optional</span>}
              </span>
              <select
                value={draftCategory}
                onChange={(e) => setDraftCategory(e.target.value)}
                className={`${bare} appearance-none`}
              >
                {adding && <option value="">Guess it for me</option>}
                {/* A row may hold a Category from before the current list. */}
                {!adding && !categories.some((c) => c === category) && (
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
                max={adding ? localToday() : undefined}
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
          {adding && draftCategory === "" && (
            <p className="-mt-2 text-xs italic" style={faint}>
              Leave it blank and a Category is guessed from the name. You can
              change it afterwards with Modify.
            </p>
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
              {pending
                ? adding && draftCategory === ""
                  ? "Guessing category…"
                  : "Saving…"
                : adding
                  ? "Add entry"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
