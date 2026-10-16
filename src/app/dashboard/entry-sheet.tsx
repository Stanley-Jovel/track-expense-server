"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BlockFooter, Link, List, ListInput, ListItem, Navbar, Page, Popup,
  Segmented, SegmentedButton, Toggle,
} from "konsta/react";
import { merchantName } from "@/app/services/analytics/merchant";
import { addTransaction, modifyTransaction } from "./actions";
import { usePopup } from "./use-popup";

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
 * The Entry sheet: an iOS modal (Konsta Popup) with Cancel and Save in its
 * navbar. In modify mode it sits behind an entry's Modify action: edits its
 * name (Motive), Category, amount and date together; Type stays as logged.
 * The amount is the headline, the rest sit beneath it as a grouped list. When an Expense's
 * Category changes, a toggle (on by default) also saves it as a Category
 * Override for the Merchant; unchecked, only this entry changes.
 *
 * In add mode (Add Entry) the same sheet starts empty, with an
 * Expense/Income toggle and the day defaulting to today; future days are
 * refused. Category is optional: left blank, one is chosen on save (see
 * addTransaction). No Category Override toggle.
 */
export function EntrySheet(props: ModifyProps | AddProps) {
  const adding = props.mode === "add";
  const { categories } = props;
  const { opened, close: onClose } = usePopup(props.onClose);
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

  const title = `${adding ? "Add" : "Modify"} ${type === "Income" ? "Income" : "Expense"}`;
  const saveLabel = pending
    ? adding && draftCategory === ""
      ? "Guessing…"
      : "Saving…"
    : adding
      ? "Add"
      : "Save";
  const canSave = valid && !pending;

  return (
    <Popup opened={opened} onBackdropClick={() => !pending && onClose()}>
      <Page>
        <Navbar
          title={title}
          left={
            <Link onClick={() => !pending && onClose()}>
              Cancel
            </Link>
          }
          right={
            <Link
              onClick={save}
              className={`font-semibold ${canSave ? "" : "pointer-events-none opacity-40"}`}
            >
              {saveLabel}
            </Link>
          }
        />
        <form
          className="mx-auto max-w-2xl pb-10"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          {adding && (
            <div className="mx-4 mt-4" role="radiogroup" aria-label="Type">
              <Segmented strong>
                {(["Expense", "Income"] as const).map((t) => (
                  <SegmentedButton
                    key={t}
                    active={type === t}
                    role="radio"
                    aria-checked={type === t}
                    onClick={(e: React.MouseEvent) => {
                      e.preventDefault();
                      switchType(t);
                    }}
                  >
                    {t}
                  </SegmentedButton>
                ))}
              </Segmented>
            </div>
          )}
          <List strong inset>
            <ListItem
              title={
                <span className="flex w-full items-baseline gap-1 py-2">
                  <span className="shrink-0 whitespace-nowrap text-3xl font-semibold opacity-40">{sign}$</span>
                  <input
                    inputMode="decimal"
                    value={draftAmount}
                    onChange={(e) => setDraftAmount(e.target.value)}
                    placeholder="0.00"
                    autoFocus={adding}
                    aria-label="Amount"
                    className="w-full min-w-0 bg-transparent text-4xl font-bold tabular-nums outline-none"
                  />
                </span>
              }
            />
            <ListInput
              label="Name"
              type="text"
              value={draftMotive}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDraftMotive(e.target.value)}
              placeholder={adding ? "Where or what" : undefined}
              // 16px inputs keep iOS Safari from zooming in on focus.
              inputClassName="text-base"
            />
          </List>
          <List strong inset>
            {/* A native select: a wheel picker on the iPhone. */}
            <ListInput
              label={adding ? "Category (optional)" : "Category"}
              type="select"
              dropdown
              value={draftCategory}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setDraftCategory(e.target.value)}
              inputClassName="text-base"
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
            </ListInput>
            <ListInput
              label="Date"
              type="date"
              value={day}
              max={adding ? localToday() : undefined}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDay(e.target.value)}
              inputClassName="text-base"
            />
          </List>
          {adding && draftCategory === "" && (
            <BlockFooter inset className="-mt-4 mb-6">
              Leave it blank and a Category is guessed from the name. You can
              change it afterwards with Modify.
            </BlockFooter>
          )}
          {categoryChanged && (
            <>
              <List strong inset>
                <ListItem
                  label
                  title={`Use for all ${nextMerchant}`}
                  after={
                    <Toggle
                      checked={allFromMerchant}
                      onChange={() => setAllFromMerchant(!allFromMerchant)}
                    />
                  }
                />
              </List>
              <BlockFooter inset className="-mt-4 mb-6">
                {allFromMerchant
                  ? `Every ${nextMerchant} expense, past and future, takes ${draftCategory}.`
                  : "Only this entry changes."}
              </BlockFooter>
            </>
          )}
          {error && (
            <BlockFooter inset role="alert" className="text-[#FF3B30]">
              {error}
            </BlockFooter>
          )}
          {/* Lets the keyboard's Go/Return submit. */}
          <button type="submit" hidden />
        </form>
      </Page>
    </Popup>
  );
}
