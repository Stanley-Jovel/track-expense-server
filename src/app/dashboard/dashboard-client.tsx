"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Transaction } from "@/app/services/spreadsheet/types";
import {
  DashboardFilter,
  WindowKey,
  allCategories,
  allMonthKeys,
  allYearKeys,
  biggestMovers,
  categoryBreakdown,
  cumulativePace,
  filterTransactions,
  isYearKey,
  paceStats,
  spendingOverTime,
  topMerchants,
} from "@/app/services/analytics/aggregate";
import { merchantName } from "@/app/services/analytics/merchant";
import { MonthlyTrendChart, PaceChart } from "./charts";
import { EntryCategoryLine } from "./category-picker";
import { formatDay, formatMonthLong, formatUsd } from "./format";

export type SerializableTransaction = Omit<Transaction, "date"> & {
  date: string;
};

type SortOrder = "newest" | "oldest" | "largest";
type PeriodMode = "months" | "years" | "all";

const PAGE_SIZE = 25;

export function DashboardClient({
  transactions: raw,
  fetchedAt,
}: {
  transactions: SerializableTransaction[];
  /** Server render time; the deterministic "now" for pace and projections. */
  fetchedAt: number;
}) {
  const transactions = useMemo<Transaction[]>(
    () => raw.map((t) => ({ ...t, date: new Date(t.date) })),
    [raw]
  );
  const now = useMemo(() => new Date(fetchedAt), [fetchedAt]);

  const months = useMemo(() => allMonthKeys(transactions), [transactions]);
  const years = useMemo(() => allYearKeys(transactions), [transactions]);
  const categories = useMemo(() => allCategories(transactions), [transactions]);

  // The view persists in the URL so a refresh keeps what was on screen.
  const searchParams = useSearchParams();
  const defaultPeriod = months[months.length - 1] ?? "all"; // latest month

  const [period, setPeriod] = useState<WindowKey>(() => {
    const w = searchParams.get("w");
    return w && (w === "all" || months.includes(w) || years.includes(w))
      ? w
      : defaultPeriod;
  });
  const [type, setType] = useState<DashboardFilter["type"]>(() => {
    const t = searchParams.get("t");
    return t === "Income" || t === "Expense" ? t : "all";
  });
  const [category, setCategory] = useState<string>(() => {
    const c = searchParams.get("c");
    return c && categories.includes(c) ? c : "all";
  });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    const params = new URLSearchParams();
    if (period !== defaultPeriod) params.set("w", period);
    if (type !== "all") params.set("t", type);
    if (category !== "all") params.set("c", category);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : location.pathname);
  }, [period, type, category, defaultPeriod]);

  const filter = useMemo<DashboardFilter>(
    () => ({ window: period, type, category }),
    [period, type, category]
  );

  const mode: PeriodMode =
    period === "all" ? "all" : isYearKey(period) ? "years" : "months";
  const yearly = mode === "years";
  const unit = yearly ? "year" : "month";

  const stats = useMemo(
    () => paceStats(transactions, filter, now),
    [transactions, filter, now]
  );
  const pace = useMemo(
    () => cumulativePace(transactions, filter, now),
    [transactions, filter, now]
  );
  const trend = useMemo(
    () => (mode === "all" ? spendingOverTime(transactions, filter) : []),
    [transactions, filter, mode]
  );
  const movers = useMemo(
    () => biggestMovers(transactions, filter, now),
    [transactions, filter, now]
  );
  const breakdown = useMemo(
    () => categoryBreakdown(transactions, filter),
    [transactions, filter]
  );
  const merchants = useMemo(
    () => topMerchants(transactions, filter),
    [transactions, filter]
  );

  const listed = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = filterTransactions(transactions, filter)
      .map((t) => ({ ...t, merchant: merchantName(t.motive) }))
      .filter(
        (t) =>
          needle === "" ||
          t.motive.toLowerCase().includes(needle) ||
          t.merchant.toLowerCase().includes(needle) ||
          t.category.toLowerCase().includes(needle)
      );
    return rows.sort((a, b) => {
      if (sort === "largest") return b.amount - a.amount;
      const diff = a.date.getTime() - b.date.getTime();
      return sort === "oldest" ? diff : -diff;
    });
  }, [transactions, filter, search, sort]);

  // Arrows step through siblings of the current period, oldest → newest.
  const siblings = yearly ? years : months;
  const periodIndex = siblings.indexOf(period);
  const changePeriod = (next: WindowKey) => {
    setPeriod(next);
    setVisibleCount(PAGE_SIZE);
  };
  const stepPeriod = (dir: 1 | -1) => {
    const next = siblings[periodIndex + dir];
    if (next) changePeriod(next);
  };
  const changeMode = (to: PeriodMode) => {
    if (to === mode) return;
    if (to === "all") changePeriod("all");
    if (to === "years")
      changePeriod(mode === "months" ? period.slice(0, 4) : years[years.length - 1]);
    if (to === "months") {
      const inYear = yearly ? months.filter((m) => m.startsWith(period)) : [];
      changePeriod(inYear[inYear.length - 1] ?? defaultPeriod);
    }
  };

  const { isCurrent, elapsedDays, totalDays } = stats.progress;
  const periodLabel =
    mode === "all"
      ? "All time"
      : yearly
        ? `${period} — ${isCurrent ? "year to date" : "full year"}`
        : `${formatMonthLong(period)}${isCurrent ? `, day ${elapsedDays} of ${totalDays}` : ""}`;

  const vsLast =
    stats.previousAtSamePoint === null
      ? null
      : stats.spending - stats.previousAtSamePoint;

  const statStrip: [string, string][][] =
    mode === "all"
      ? [
          [
            ["Daily average", formatUsd(stats.dailyAverage)],
            ["To savings & transfers", formatUsd(stats.moneyMovement)],
            ["Entries", String(stats.entries)],
          ],
        ]
      : [
          [
            ["Daily average", formatUsd(stats.dailyAverage)],
            [`Projected ${unit}`, formatUsd(stats.projected)],
            [
              `${yearly ? "Year" : "Month"} elapsed`,
              `${Math.round((elapsedDays / totalDays) * 100)}%`,
            ],
          ],
          [
            [`Last ${unit} total`, formatUsd(stats.previousTotal ?? 0)],
            ["To savings & transfers", formatUsd(stats.moneyMovement)],
            ["Entries", String(stats.entries)],
          ],
        ];

  return (
    <main className="mx-auto max-w-2xl px-5 pb-16 sm:px-8">
      {/* Masthead: period navigation */}
      <header className="flex items-baseline justify-between pt-2">
        <h1
          className="text-xs uppercase tracking-[0.25em]"
          style={{ color: "var(--ledger-faint)" }}
        >
          The Ledger
        </h1>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-baseline gap-1">
            <button
              onClick={() => stepPeriod(-1)}
              disabled={mode === "all" || periodIndex <= 0}
              aria-label={`Previous ${unit}`}
              className="px-1.5 text-sm disabled:opacity-25"
              style={{ color: "var(--ledger-faint)" }}
            >
              ‹
            </button>
            <p className="text-xs italic" style={{ color: "var(--ledger-faint)" }}>
              {periodLabel}
            </p>
            <button
              onClick={() => stepPeriod(1)}
              disabled={mode === "all" || periodIndex >= siblings.length - 1}
              aria-label={`Next ${unit}`}
              className="px-1.5 text-sm disabled:opacity-25"
              style={{ color: "var(--ledger-faint)" }}
            >
              ›
            </button>
          </div>
          <p
            className="text-[10px] uppercase tracking-[0.2em]"
            style={{ color: "var(--ledger-faint)" }}
          >
            {(["months", "years", "all"] as const).map((m, i) => (
              <span key={m}>
                {i > 0 && "·"}
                <button
                  onClick={() => changeMode(m)}
                  className="px-1"
                  style={{
                    textDecoration: mode === m ? "underline" : "none",
                    textUnderlineOffset: 3,
                  }}
                >
                  {m === "all" ? "all time" : m}
                </button>
              </span>
            ))}
          </p>
        </div>
      </header>

      {/* Hero figure */}
      <section className="mt-7 text-center">
        <p className="text-sm italic" style={{ color: "var(--ledger-faint)" }}>
          {mode === "all"
            ? "spent all time"
            : isCurrent
              ? `spent so far this ${unit}`
              : yearly
                ? `spent in ${period}`
                : "spent this month"}
        </p>
        <p
          className="mt-1 text-5xl tracking-tight sm:text-6xl"
          style={{ fontVariantNumeric: "oldstyle-nums" }}
        >
          {formatUsd(stats.spending)}
        </p>
        {vsLast !== null && (
          <p
            className="mt-2 text-sm"
            style={{
              color: vsLast > 0 ? "var(--ledger-up)" : "var(--ledger-down)",
            }}
          >
            {vsLast >= 0 ? "▲" : "▼"} {formatUsd(Math.abs(vsLast))}{" "}
            <span style={{ color: "var(--ledger-faint)" }}>
              vs. last {unit}
              {isCurrent ? " at this point" : ""}
            </span>
          </p>
        )}
      </section>

      {/* Stat strip */}
      <section
        className="mt-7 border-y"
        style={{ borderColor: "var(--ledger-rule)" }}
      >
        {statStrip.map((row, i) => (
          <div
            key={i}
            className={`grid grid-cols-3 divide-x py-4 text-center ${i > 0 ? "border-t" : ""}`}
            style={{ borderColor: "var(--ledger-rule)" }}
          >
            {row.map(([label, value]) => (
              <div
                key={label}
                className="px-2"
                style={{ borderColor: "var(--ledger-rule)" }}
              >
                <p className="text-lg sm:text-xl">{value}</p>
                <p
                  className="mt-1 text-[11px] uppercase tracking-wider"
                  style={{ color: "var(--ledger-faint)" }}
                >
                  {label}
                </p>
              </div>
            ))}
          </div>
        ))}
      </section>

      {/* Filters */}
      <div className="mt-6 flex gap-2">
        <Select
          value={type}
          onValueChange={(v) => v !== null && setType(v as DashboardFilter["type"])}
        >
          <SelectTrigger className="flex-1" aria-label="Type">
            <SelectValue>{type === "all" ? "All types" : type}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="Expense">Expense</SelectItem>
            <SelectItem value="Income">Income</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={category}
          onValueChange={(v) => v !== null && setCategory(v)}
        >
          <SelectTrigger className="flex-1" aria-label="Category">
            <SelectValue>
              {category === "all" ? "All categories" : category}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Pace / trend */}
      <SectionTitle>
        {mode === "all" ? "Spending by month" : `Pace — this ${unit} against last`}
      </SectionTitle>
      {mode === "all" ? (
        <MonthlyTrendChart data={trend} />
      ) : (
        <PaceChart data={pace} yearly={yearly} />
      )}

      {/* Movers */}
      {movers.length > 0 && (
        <>
          <SectionTitle>Where it moved</SectionTitle>
          <div className="space-y-2">
            {movers.map((m) => (
              <div
                key={m.category}
                className="flex items-baseline justify-between gap-3 text-sm"
              >
                <span>{m.category}</span>
                <span
                  className="flex-1 border-b border-dotted"
                  style={{ borderColor: "var(--ledger-rule)" }}
                />
                <span
                  className="tabular-nums"
                  style={{
                    color: m.delta > 0 ? "var(--ledger-up)" : "var(--ledger-down)",
                  }}
                >
                  {m.delta >= 0 ? "+" : "−"}
                  {formatUsd(Math.abs(m.delta))}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Categories */}
      <SectionTitle>Spending by category</SectionTitle>
      {breakdown.length === 0 && <EmptyNote />}
      <div className="space-y-2.5">
        {breakdown.slice(0, 10).map((c) => {
          const max = breakdown[0].amount;
          return (
            <div key={c.category}>
              <div className="flex items-baseline justify-between text-sm">
                <span>{c.category}</span>
                <span className="tabular-nums">{formatUsd(c.amount)}</span>
              </div>
              <div
                className="mt-1 h-px w-full"
                style={{ background: "var(--ledger-rule)" }}
              >
                <div
                  style={{
                    width: `${Math.max((c.amount / max) * 100, 1)}%`,
                    background: "var(--ledger-ink)",
                    height: 3,
                    marginTop: -1,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Merchants */}
      <SectionTitle>Top merchants</SectionTitle>
      {merchants.length === 0 && <EmptyNote />}
      <div className="space-y-1.5">
        {merchants.map((m, i) => (
          <div key={m.merchant} className="flex items-baseline gap-3 text-sm">
            <span
              className="w-5 shrink-0 text-right italic"
              style={{ color: "var(--ledger-faint)" }}
            >
              {i + 1}.
            </span>
            <span className="min-w-0 truncate">{m.merchant}</span>
            <span className="text-xs italic" style={{ color: "var(--ledger-faint)" }}>
              ×{m.count}
            </span>
            <span className="ml-auto shrink-0 tabular-nums">
              {formatUsd(m.amount)}
            </span>
          </div>
        ))}
      </div>

      {/* Entries */}
      <SectionTitle>Entries ({listed.length})</SectionTitle>
      <div className="mb-3 flex gap-2">
        <Input
          placeholder="Search merchant or category"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          className="flex-1"
        />
        <Select
          value={sort}
          onValueChange={(v) => v !== null && setSort(v as SortOrder)}
        >
          <SelectTrigger className="w-[110px]" aria-label="Sort">
            <SelectValue>
              {sort === "newest" ? "Newest" : sort === "oldest" ? "Oldest" : "Largest"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="oldest">Oldest</SelectItem>
            <SelectItem value="largest">Largest</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {listed.length === 0 && <EmptyNote />}
      <div>
        {listed.slice(0, visibleCount).map((t, i) => (
          <div
            key={`${t.date.getTime()}-${t.motive}-${i}`}
            className="flex items-center justify-between gap-3 border-b py-2.5 last:border-0"
            style={{ borderColor: "var(--ledger-rule)" }}
          >
            <div className="min-w-0">
              <p className="truncate text-sm" title={t.motive}>
                {t.merchant}
              </p>
              {t.type === "Expense" ? (
                <EntryCategoryLine
                  merchant={t.merchant}
                  category={t.category}
                  dateLabel={formatDay(t.date)}
                />
              ) : (
                // Overrides only recategorize Expenses, so Income has no picker.
                <p className="mt-0.5 text-xs" style={{ color: "var(--ledger-faint)" }}>
                  {t.category} · {formatDay(t.date)}
                </p>
              )}
            </div>
            <span
              className="shrink-0 text-sm tabular-nums"
              style={
                t.type === "Income" ? { color: "var(--ledger-down)" } : undefined
              }
            >
              {t.type === "Income" ? "+" : "−"}
              {formatUsd(t.amount)}
            </span>
          </div>
        ))}
      </div>
      {listed.length > visibleCount && (
        <button
          onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
          className="mt-4 w-full border py-2 text-sm italic"
          style={{
            borderColor: "var(--ledger-rule)",
            color: "var(--ledger-faint)",
          }}
        >
          Show more ({listed.length - visibleCount} remaining)
        </button>
      )}
    </main>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-3 mt-10 border-b pb-1 text-[11px] uppercase tracking-[0.2em]"
      style={{ color: "var(--ledger-faint)", borderColor: "var(--ledger-rule)" }}
    >
      {children}
    </h2>
  );
}

function EmptyNote() {
  return (
    <p className="py-4 text-center text-sm" style={{ color: "var(--ledger-faint)" }}>
      Nothing here for this filter.
    </p>
  );
}
