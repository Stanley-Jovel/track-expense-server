"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { merchantName } from "@/app/services/analytics/merchant";
import type { CategorySuggestion } from "@/app/services/categories/open-categories";
import { approveSuggestion } from "./suggestion-actions";
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
export function SuggestionsBanner({ suggestions }: { suggestions: CategorySuggestion[] }) {
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
      {open && <ReviewDeck suggestions={suggestions} onClose={() => setOpen(false)} />}
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
  onClose,
}: {
  suggestions: CategorySuggestion[];
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

function SuggestionCard({
  suggestion,
  remaining,
  onPendingChange,
  onAnswered,
  onSkip,
}: {
  suggestion: CategorySuggestion;
  remaining: number;
  onPendingChange: (pending: boolean) => void;
  onAnswered: () => void;
  onSkip: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [choice, setChoice] = useState<"spending" | "movement" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(suggestion.label);
  const trimmed = name.trim();

  const approve = (countsAsSpending: boolean) => {
    if (trimmed === "" || pending) return;
    setError(null);
    setChoice(countsAsSpending ? "spending" : "movement");
    onPendingChange(true);
    startTransition(async () => {
      try {
        const result = await approveSuggestion({
          key: suggestion.key,
          entries: suggestion.entries.map(({ row, motive, amount }) => ({ row, motive, amount })),
          name: trimmed,
          countsAsSpending,
        });
        if (result.ok) {
          onAnswered();
          router.refresh();
        } else {
          setError(result.error);
        }
      } catch {
        setError(`Couldn't add ${trimmed}. Try again.`);
      } finally {
        onPendingChange(false);
      }
    });
  };

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
