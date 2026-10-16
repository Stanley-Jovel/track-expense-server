"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Inbox } from "lucide-react";
import {
  Block, BlockFooter, BlockTitle, Button, List, ListItem,
} from "konsta/react";
import { merchantName } from "@/app/services/analytics/merchant";
import type { CategorySuggestion } from "@/app/services/categories/open-categories";
import {
  approveSuggestion,
  dismissSuggestion,
  foldSuggestion,
  mergeSuggestion,
  type ReviewResult,
} from "./suggestion-actions";
import { formatUsd } from "./format";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const RED = "#FF3B30";

/**
 * The Review tab: one waiting Category Suggestion at a time. Answered
 * Suggestions leave the deck at once (the refreshed list confirms it);
 * skipped ones go to the back for this visit only. Says "All Caught Up" when
 * nothing is waiting.
 */
export function ReviewDeck({
  suggestions,
  categories,
}: {
  suggestions: CategorySuggestion[];
  /** The Category list, for "It's another category…". */
  categories: readonly string[];
}) {
  const [answered, setAnswered] = useState<string[]>([]);
  const [skipped, setSkipped] = useState<string[]>([]);

  const waiting = suggestions.filter((s) => !answered.includes(s.key));
  const deck = [
    ...waiting.filter((s) => !skipped.includes(s.key)),
    // In skip order, so skipping twice cycles through them.
    ...skipped.flatMap((key) => waiting.filter((s) => s.key === key)),
  ];
  const current = deck[0];

  if (!current) {
    return (
      <div className="flex flex-col items-center px-8 pt-32 text-center opacity-80">
        <Inbox size={56} strokeWidth={1.4} className="mb-3 opacity-50" />
        <p className="text-[22px] font-bold">All Caught Up</p>
        <p className="mt-1 text-[15px] opacity-60">Every suggested category has an answer.</p>
      </div>
    );
  }

  return (
    <SuggestionCard
      // A fresh card per Suggestion resets its rename and error state.
      key={current.key}
      suggestion={current}
      categories={categories}
      remaining={deck.length - 1}
      onAnswered={() => setAnswered((keys) => [...keys, current.key])}
      onSkip={() =>
        setSkipped((keys) => [...keys.filter((k) => k !== current.key), current.key])
      }
    />
  );
}

// Which answer is in flight, to label its button.
type Choice = "hint" | "spending" | "movement" | "other" | "dismiss";

function SuggestionCard({
  suggestion,
  categories,
  remaining,
  onAnswered,
  onSkip,
}: {
  suggestion: CategorySuggestion;
  categories: readonly string[];
  remaining: number;
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
  // server's error shows inline and this Suggestion stays. Either way the page
  // refreshes, so a half-done answer (an approval whose entries couldn't
  // move) shows its new Category in the picker.
  const answerWith = (next: Choice, act: () => Promise<ReviewResult>) => {
    if (pending) return;
    setError(null);
    setChoice(next);
    startTransition(async () => {
      try {
        const result = await act();
        if (result.ok) onAnswered();
        else setError(result.error);
      } catch {
        // The action never answered (offline, or the server failed).
        setError("Couldn't reach the server. Try again.");
      } finally {
        router.refresh();
      }
    });
  };

  const approve = (countsAsSpending: boolean) => {
    if (trimmed === "") return;
    answerWith(
      countsAsSpending ? "spending" : "movement",
      () => approveSuggestion({ ...listed, name: trimmed, countsAsSpending })
    );
  };

  const merge = (into: string, via: Choice) =>
    answerWith(
      via,
      () => mergeSuggestion({ ...listed, into })
    );

  // A Suggestion look-alike: its entries join that Suggestion, answered later.
  const fold = (into: string) =>
    answerWith(
      "hint",
      () => foldSuggestion({ ...listed, into })
    );

  const hint = suggestion.hint;
  const count = suggestion.entries.length;
  const label = (busy: Choice, idle: string, during: string) =>
    pending && choice === busy ? during : idle;

  return (
    <div className="pb-6">
      <Block className="text-center">
        <p className="text-[15px] opacity-60">A new category?</p>
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
            className="mt-1 w-full border-b border-current/20 bg-transparent text-center text-[34px] font-bold outline-none"
          />
        ) : (
          <button
            onClick={() => setRenaming(true)}
            disabled={pending}
            aria-label={`Rename ${trimmed || "suggestion"}`}
            className="mt-1 max-w-full break-words text-[34px] font-bold leading-tight"
          >
            {trimmed || <span className="opacity-40">Name it</span>}
          </button>
        )}
        <p className="mt-1 text-[13px] opacity-60">
          {plural(count, "entry", "entries")} · {formatUsd(suggestion.total)} ·{" "}
          {renaming ? "type a name" : "tap the name to rename"}
        </p>
      </Block>

      <BlockTitle>Entries</BlockTitle>
      <List strong inset>
        {suggestion.entries.map((e) => (
          <ListItem
            key={e.row}
            title={merchantName(e.motive)}
            footer={`now ${e.category}`}
            after={<span className="tabular-nums">{formatUsd(e.amount)}</span>}
          />
        ))}
      </List>

      {error && (
        <BlockFooter inset role="alert" style={{ color: RED }}>
          {error}
        </BlockFooter>
      )}

      <Block>
        <Button
          large
          rounded
          onClick={() => approve(true)}
          disabled={pending || trimmed === ""}
        >
          {label("spending", "Yes, Add It as Spending", "Adding…")}
        </Button>
      </Block>
      <List strong inset>
        {hint && (
          <ListItem
            link
            chevron={false}
            title={
              <span className="text-primary">
                {label(
                  "hint",
                  `No, it’s ${hint.kind === "category" ? hint.name : hint.label}`,
                  "Moving…"
                )}
              </span>
            }
            footer={hint.kind === "category" ? "existing category" : "also suggested"}
            onClick={() =>
              !pending && (hint.kind === "category" ? merge(hint.name, "hint") : fold(hint.label))
            }
          />
        )}
        <ListItem
          link
          chevron={false}
          title={<span className="text-primary">{label("movement", "Yes, as Money Movement", "Adding…")}</span>}
          footer="savings, transfers, loan principal: not Spending"
          onClick={() => !pending && approve(false)}
        />
        {/* A native picker: a wheel on the iPhone. Picking a Category is the
            answer, as tapping a row is. */}
        <ListItem
          className="relative"
          title={<span className="text-primary">{label("other", "It’s Another Category…", "Moving…")}</span>}
          footer="move these entries into one on the list"
          innerChildren={
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
          }
        />
        <ListItem
          link
          chevron={false}
          title={<span style={{ color: RED }}>{label("dismiss", "Not a Category", "Dismissing…")}</span>}
          footer="keeps each entry where it is"
          onClick={() => !pending && answerWith("dismiss", () => dismissSuggestion(listed))}
        />
      </List>

      <div className="flex items-center justify-between px-8 text-[13px] opacity-60">
        <button
          onClick={onSkip}
          disabled={pending || remaining === 0}
          className="min-h-11 text-primary disabled:opacity-40"
        >
          Skip for Now
        </button>
        <span>{remaining > 0 ? `${remaining} more after this` : "last one"}</span>
      </div>
    </div>
  );
}
