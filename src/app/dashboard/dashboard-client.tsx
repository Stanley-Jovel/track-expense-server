"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  allCategories,
  allMonthKeys,
  categoryBreakdown,
  computeStats,
  filterTransactions,
  incomeVsSpendingByMonth,
  spendingOverTime,
  topMotives,
} from "@/app/services/analytics/aggregate";
import { IncomeVsSpendingChart, SpendingTrendChart } from "./charts";
import { formatDay, formatMonthLong, formatUsd } from "./format";

export type SerializableTransaction = Omit<Transaction, "date"> & {
  date: string;
};

type SortOrder = "newest" | "oldest" | "largest";

const PAGE_SIZE = 25;

export function DashboardClient({
  transactions: raw,
}: {
  transactions: SerializableTransaction[];
}) {
  const transactions = useMemo<Transaction[]>(
    () => raw.map((t) => ({ ...t, date: new Date(t.date) })),
    [raw]
  );

  const months = useMemo(
    () => allMonthKeys(transactions).reverse(),
    [transactions]
  );
  const categories = useMemo(() => allCategories(transactions), [transactions]);

  // Default to the latest month that has data (normally the current month).
  const [month, setMonth] = useState<string>(months[0] ?? "all");
  const [type, setType] = useState<DashboardFilter["type"]>("all");
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filter: DashboardFilter = { month, type, category };

  const stats = useMemo(
    () => computeStats(transactions, filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, month, type, category]
  );
  const trend = useMemo(
    () => spendingOverTime(transactions, filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, month, type, category]
  );
  const breakdown = useMemo(
    () => categoryBreakdown(transactions, filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, month, type, category]
  );
  const monthly = useMemo(
    () => incomeVsSpendingByMonth(transactions, filter),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, category]
  );
  const motives = useMemo(
    () => topMotives(transactions, filter, 8),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [transactions, month, type, category]
  );

  const listed = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const rows = filterTransactions(transactions, filter).filter(
      (t) =>
        needle === "" ||
        t.motive.toLowerCase().includes(needle) ||
        t.category.toLowerCase().includes(needle)
    );
    const sorted = [...rows].sort((a, b) => {
      if (sort === "largest") return b.amount - a.amount;
      const diff = a.date.getTime() - b.date.getTime();
      return sort === "oldest" ? diff : -diff;
    });
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, month, type, category, search, sort]);

  const monthIndex = months.indexOf(month);
  const stepMonth = (dir: 1 | -1) => {
    // months[] is newest-first, so "previous month" moves toward the end.
    const next = months[monthIndex + dir];
    if (next) {
      setMonth(next);
      setVisibleCount(PAGE_SIZE);
    }
  };

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 pb-12 sm:p-6">
      {/* Header: month navigation */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold tracking-tight">Expenses</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Previous month"
            disabled={month === "all" || monthIndex === months.length - 1}
            onClick={() => stepMonth(1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select
            value={month}
            onValueChange={(v) => {
              if (v === null) return;
              setMonth(v);
              setVisibleCount(PAGE_SIZE);
            }}
          >
            <SelectTrigger className="w-[150px]" aria-label="Month">
              <SelectValue>
                {month === "all" ? "All time" : formatMonthLong(month)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All time</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonthLong(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Next month"
            disabled={month === "all" || monthIndex <= 0}
            onClick={() => stepMonth(-1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
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

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Spending"
          value={stats.spending}
          previous={stats.previous?.spending ?? null}
          upIsGood={false}
        />
        <StatTile
          label="Income"
          value={stats.income}
          previous={stats.previous?.income ?? null}
          upIsGood
        />
        <StatTile label="Net" value={stats.net} previous={null} upIsGood signed />
        <StatTile
          label="To savings & transfers"
          value={stats.moneyMovement}
          previous={null}
          upIsGood
        />
      </div>

      {/* Spending trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Spending {month === "all" ? "by month" : "by day"}
          </CardTitle>
        </CardHeader>
        <CardContent className="pl-0 pr-2">
          <SpendingTrendChart data={trend} isMonthly={month === "all"} />
        </CardContent>
      </Card>

      {/* Category breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Spending by category
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {breakdown.length === 0 && <EmptyNote />}
          {breakdown.map((slice) => {
            const max = breakdown[0].amount;
            return (
              <div key={slice.category}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">{slice.category}</span>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatUsd(slice.amount)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${Math.max((slice.amount / max) * 100, 1)}%`,
                      background: "var(--viz-spending)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Income vs spending */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Income vs spending — all months
          </CardTitle>
        </CardHeader>
        <CardContent className="pl-0 pr-2">
          <IncomeVsSpendingChart data={monthly} />
        </CardContent>
      </Card>

      {/* Top motives */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Top spending
          </CardTitle>
        </CardHeader>
        <CardContent className="divide-y">
          {motives.length === 0 && <EmptyNote />}
          {motives.map((m) => (
            <div
              key={m.motive}
              className="flex items-baseline justify-between gap-3 py-2 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{m.motive}</p>
                <p className="text-xs text-muted-foreground">
                  {m.count} transaction{m.count === 1 ? "" : "s"}
                </p>
              </div>
              <span className="shrink-0 text-sm font-medium tabular-nums">
                {formatUsd(m.amount)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardHeader className="space-y-3 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Transactions ({listed.length})
          </CardTitle>
          <div className="flex gap-2">
            <Input
              placeholder="Search motive or category"
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
        </CardHeader>
        <CardContent className="divide-y">
          {listed.length === 0 && <EmptyNote />}
          {listed.slice(0, visibleCount).map((t, i) => (
            <div
              key={`${t.date.getTime()}-${t.motive}-${i}`}
              className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm">{t.motive}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <Badge variant="secondary" className="max-w-[160px] truncate px-1.5 py-0 text-[11px] font-normal">
                    {t.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDay(t.date)}
                  </span>
                </div>
              </div>
              <span
                className="shrink-0 text-sm font-medium tabular-nums"
                style={
                  t.type === "Income"
                    ? { color: "var(--viz-delta-good)" }
                    : undefined
                }
              >
                {t.type === "Income" ? "+" : "−"}
                {formatUsd(t.amount)}
              </span>
            </div>
          ))}
          {listed.length > visibleCount && (
            <div className="pt-3">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
              >
                Show more ({listed.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function StatTile({
  label,
  value,
  previous,
  upIsGood,
  signed = false,
}: {
  label: string;
  value: number;
  previous: number | null;
  upIsGood: boolean;
  signed?: boolean;
}) {
  const delta =
    previous !== null && previous > 0
      ? ((value - previous) / previous) * 100
      : null;
  const deltaGood = delta !== null && (delta >= 0 ? upIsGood : !upIsGood);

  return (
    <Card className="gap-1 py-4">
      <CardContent className="space-y-1 px-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-lg font-semibold sm:text-xl">
          {signed && value > 0 ? "+" : ""}
          {formatUsd(value)}
        </p>
        {delta !== null && (
          <p
            className="text-xs"
            style={{
              color: deltaGood ? "var(--viz-delta-good)" : "var(--viz-delta-bad)",
            }}
          >
            {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}% vs last month
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyNote() {
  return (
    <p className="py-4 text-center text-sm text-muted-foreground">
      Nothing here for this filter.
    </p>
  );
}
