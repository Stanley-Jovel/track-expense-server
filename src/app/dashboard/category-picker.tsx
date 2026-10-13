"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EXPENSE_CATEGORIES, isExpenseCategory } from "@/app/services/llm/types";
import { correctMerchantCategory } from "./actions";

/**
 * An entry's "Category · date" line, where the Category is a tap target for
 * a native picker. Choosing a Category saves a Category Override for the
 * whole Merchant (and repairs its past rows), so the picker says so.
 *
 * The <select> is invisible and stretched over the label: tapping the label
 * opens the OS picker directly (the wheel on iOS), while the label keeps the
 * entry's width instead of the select's widest option.
 *
 * The select's value is always a disabled, empty placeholder rather than the
 * entry's Category. A native select (iOS included) fires no `change` when the
 * already-selected option is picked again, so binding it to the Category
 * would make "confirm this Category for the whole Merchant" impossible on a
 * row that is already right. With the placeholder selected, every real
 * choice is a change.
 */
export function EntryCategoryLine({
  merchant,
  category,
  dateLabel,
}: {
  merchant: string;
  category: string;
  dateLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const hint = `Applies to all ${merchant} expenses`;

  const save = (next: string) => {
    if (!isExpenseCategory(next)) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await correctMerchantCategory(merchant, next);
        if (result.ok) router.refresh();
        else setError(result.error);
      } catch {
        setError(`Couldn't save ${merchant} as ${next}. Try again.`);
      }
    });
  };

  return (
    <>
      <p className="mt-0.5 text-xs" style={{ color: "var(--ledger-faint)" }}>
        {/* Padding grows the tap target past the 12px text without moving it. */}
        <span className="relative -my-2 inline-block py-2">
          <span
            className="underline decoration-dotted underline-offset-2"
            style={{ textDecorationColor: "var(--ledger-rule)" }}
          >
            {pending ? "Saving…" : category}
          </span>
          <select
            aria-label={`Category for ${merchant}. ${hint}.`}
            title={hint}
            value=""
            disabled={pending}
            onChange={(e) => save(e.target.value)}
            // 16px keeps iOS Safari from zooming in when the picker opens.
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 text-base"
          >
            <option value="" disabled>
              {category}
            </option>
            <optgroup label={hint}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </optgroup>
          </select>
        </span>
        {" · "}
        {dateLabel}
      </p>
      {error && (
        <p role="alert" className="mt-0.5 text-xs italic" style={{ color: "var(--ledger-up)" }}>
          {error}
        </p>
      )}
    </>
  );
}
