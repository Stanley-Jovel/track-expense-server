"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { merchantName } from "@/app/services/analytics/merchant";
import type { CategorySuggestion } from "@/app/services/categories/open-categories";
import { approveSuggestion, foldSuggestion, mergeSuggestion, type ReviewResult } from "./suggestion-actions";
import { formatUsd } from "./format";

const faint = { color: "var(--ledger-faint)" };
const rule = { borderColor: "var(--ledger-rule)" };
const ink = {
  borderColor: "var(--ledger-ink)",
  background: "var(--ledger-ink)",
  color: "var(--ledger-paper)",
};
// Full-width answers, at least 48px tall: thumb targets on a phone.
const answer = "min-h-12 w-full border px-4 py-2 text-left text-base disabled:opacity-40";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The banner under the masthead that counts the waiting Category
 * Suggestions and opens the review deck. Hidden when nothing is waiting; the
 * deck stays open after the last answer so it can say "All caught up".
 */
export function SuggestionsBanner({
  suggestions,
  categories,
}: {
  suggestions: CategorySuggestion[];
  /** The Category list, for "It's another category…". */
  categories: readonly string[];
}) {
  const [open, setOpen] = useState(false);
  const entries = suggestions.reduce((n, s) => n + s.entries.length, 0);

  return (
    <>
      {suggestions.length > 0 && (
        <button
          onClick={() => setOpen(true)}
          className="mt-5 flex w-full items-center justify-between gap-3 border px-4 py-3 text-left"
          style={{ borderColor: "var(--ledger-ink)" }}
        >
          <span className="min-w-0">
            <span className="block text-sm">
              {plural(suggestions.length, "new category", "new categories")} suggested
            </span>
            <span className="block text-xs italic" style={faint}>
              from {plural(entries, "entry", "entries")} that didn&apos;t fit the list
            </span>
          </span>
          <span className="shrink-0 text-sm">Review ›</span>
        </button>
      )}
      {open && (
        <ReviewDeck
          suggestions={suggestions}
          categories={categories}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/**
 * A tall bottom sheet that shows one waiting Suggestion at a time. Answered
 * Suggestions leave the deck at once (the refreshed list confirms it);
 * skipped ones go to the back for this visit only.
 */
function ReviewDeck({
  suggestions,
  categories,
  onClose,
}: {
  suggestions: CategorySuggestion[];
  categories: readonly string[];
  onClose: () => void;
}) {
  const [answered, setAnswered] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [pending, setPending] = useState(false);

  const waiting = suggestions.filter((s) => !answered.includes(s.key));
  const deck = [
    ...waiting.filter((s) => !skipped.includes(s.key)),
    // In skip order, so skipping twice cycles through them.
    ...skipped.flatMap((key) => waiting.filter((s) => s.key === key)),
  ];
  const current = deck[0];

  return (
    <Sheet open onOpenChange={(open) => !open && !pending && onClose()}>
      <SheetContent
        side="bottom"
        finalFocus={false}
        // A tall sheet that keeps its height from card to card; the side
        // variant is needed to beat the bottom sheet's own h-auto.
        className="mx-auto max-w-2xl gap-0 overflow-y-auto rounded-t-xl px-5 pb-10 pt-5 data-[side=bottom]:h-[88dvh]"
        style={{
          background: "var(--ledger-card)",
          color: "var(--ledger-ink)",
          fontFamily: "var(--font-ledger)",
        }}
      >
        <div
          className="mx-auto -mt-2 mb-1 h-1 w-10 shrink-0 rounded-full"
          style={{ background: "var(--ledger-rule)" }}
        />
        <SheetTitle
          className="mb-5 text-center text-xs uppercase tracking-[0.25em]"
          style={faint}
        >
          {current ? `${deck.length} to review` : "Suggested categories"}
        </SheetTitle>
        {current ? (
          <SuggestionCard
            // A fresh card per Suggestion resets its rename and error state.
            key={current.key}
            suggestion={current}
            categories={categories}
            remaining={deck.length - 1}
            onPendingChange={setPending}
            onAnswered={() => setAnswered((keys) => [...keys, current.key])}
            onSkip={() =>
              setSkipped((keys) => [...keys.filter((k) => k !== current.key), current.key])
            }
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
            <p className="text-3xl">All caught up</p>
            <p className="text-sm italic" style={faint}>
              Every suggested category has an answer.
            </p>
            <button onClick={onClose} className="min-h-11 w-40 border px-3 text-sm" style={ink}>
              Done
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Which answer is in flight, to label its button.
type Choice = "hint" | "spending" | "movement" | "other";

function SuggestionCard({
  suggestion,
  categories,
  remaining,
  onPendingChange,
  onAnswered,
  onSkip,
}: {
  suggestion: CategorySuggestion;
  categories: readonly string[];
  remaining: number;
  onPendingChange: (pending: boolean) => void;
  onAnswered: () => void;
  onSkip: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<Choice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(suggestion.label);
  const trimmed = name.trim();

  // The entries as the deck listed them, so the action can skip any row
  // that changed since.
  const listed = {
    key: suggestion.key,
    entries: suggestion.entries.map(({ row, motive, amount }) => ({ row, motive, amount })),
  };

  // Runs one answer. On success the next Suggestion shows; on failure the
  // error shows inline and this Suggestion stays. Either way the page
  // refreshes, so a half-done answer (an approval whose entries couldn't
  // move) shows its new Category in the picker.
  const answerWith = (next: Choice, act: () => Promise<ReviewResult>, failure: string) => {
    if (pending) return;
    setError(null);
    setChoice(next);
    onPendingChange(true);
    startTransition(async () => {
      try {
        const result = await act();
        if (result.ok) onAnswered();
        else setError(result.error);
      } catch {
        setError(failure);
      } finally {
        onPendingChange(false);
        router.refresh();
      }
    });
  };

  const approve = (countsAsSpending: boolean) => {
    if (trimmed === "") return;
    answerWith(
      countsAsSpending ? "spending" : "movement",
      () => approveSuggestion({ ...listed, name: trimmed, countsAsSpending }),
      `Couldn't add ${trimmed}. Try again.`
    );
  };

  const merge = (into: string, via: Choice) =>
    answerWith(
      via,
      () => mergeSuggestion({ ...listed, into }),
      `Couldn't move these into ${into}. Try again.`
    );

  // A Suggestion look-alike: its entries join that Suggestion, answered later.
  const fold = (into: string) =>
    answerWith(
      "hint",
      () => foldSuggestion({ ...listed, into }),
      `Couldn't fold these into ${into}. Try again.`
    );

  const hint = suggestion.hint;
  const count = suggestion.entries.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <p className="text-sm italic" style={faint}>
          A new category?
        </p>
        {renaming ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setRenaming(false)}
            onKeyDown={(e) => e.key === "Enter" && setRenaming(false)}
            aria-label="Category name"
            maxLength={60}
            enterKeyHint="done"
            className="mt-1 w-full border-b bg-transparent text-center text-4xl outline-none"
            style={rule}
          />
        ) : (
          <button
            onClick={() => setRenaming(true)}
            disabled={pending}
            aria-label={`Rename ${trimmed || "suggestion"}`}
            className="mt-1 max-w-full break-words text-4xl leading-tight"
          >
            {trimmed || <span style={faint}>Name it</span>}
          </button>
        )}
        <p className="mt-2 text-xs italic" style={faint}>
          {plural(count, "entry", "entries")} · {formatUsd(suggestion.total)} ·{" "}
          {renaming ? "type a name" : "tap the name to rename"}
        </p>
      </div>

      <ul className="border-t" style={rule}>
        {suggestion.entries.map((e) => (
          <li
            key={e.row}
            className="flex items-baseline gap-3 border-b py-2 text-sm"
            style={rule}
          >
            <span className="min-w-0 flex-1 truncate">{merchantName(e.motive)}</span>
            <span className="max-w-[40%] shrink-0 truncate text-xs italic" style={faint}>
              now {e.category}
            </span>
            <span className="shrink-0 tabular-nums">{formatUsd(e.amount)}</span>
          </li>
        ))}
      </ul>

      {error && (
        <p role="alert" className="text-xs italic" style={{ color: "var(--ledger-up)" }}>
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {hint && (
          <button
            onClick={() =>
              hint.kind === "category" ? merge(hint.name, "hint") : fold(hint.label)
            }
            disabled={pending}
            className={answer}
            style={rule}
          >
            {pending && choice === "hint"
              ? "Moving…"
              : `No, it's ${hint.kind === "category" ? hint.name : hint.label}`}
            <span className="block text-xs italic" style={faint}>
              {hint.kind === "category" ? "existing category" : "also suggested"}
            </span>
          </button>
        )}
        <button
          onClick={() => approve(true)}
          disabled={pending || trimmed === ""}
          className={answer}
          style={ink}
        >
          {pending && choice === "spending" ? "Adding…" : "Yes, add it as Spending"}
        </button>
        <button
          onClick={() => approve(false)}
          disabled={pending || trimmed === ""}
          className={answer}
          style={rule}
        >
          {pending && choice === "movement" ? "Adding…" : "Yes, as Money Movement"}
          <span className="block text-xs italic" style={faint}>
            savings, transfers, loan principal: not Spending
          </span>
        </button>
        {/* A native picker: a wheel on the iPhone. Picking a Category is the
            answer, as tapping a button is. */}
        <label className={`${answer} relative flex items-center`} style={rule}>
          <span>
            {pending && choice === "other" ? "Moving…" : "It’s another category…"}
          </span>
          <select
            value=""
            disabled={pending}
            onChange={(e) => e.target.value && merge(e.target.value, "other")}
            aria-label="It's another category"
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            <option value="" disabled>
              Move these into…
            </option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between text-xs" style={faint}>
        <button
          onClick={onSkip}
          disabled={pending || remaining === 0}
          className="min-h-11 underline underline-offset-4 disabled:no-underline disabled:opacity-40"
        >
          Skip for now
        </button>
        <span>{remaining > 0 ? `${remaining} more after this` : "last one"}</span>
      </div>
    </div>
  );
}
