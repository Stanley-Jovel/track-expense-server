"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown, Check, ChartPie, ChevronLeft, ChevronRight, Inbox, List as ListIcon,
  ListFilter, Plus, RefreshCw,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  Actions, ActionsButton, ActionsGroup, ActionsLabel, App, Badge, Block,
  BlockFooter, BlockTitle, Chip, Link, List, ListButton, ListItem, Navbar,
  Page, Popup, Searchbar, Segmented, SegmentedButton, Tabbar, TabbarLink, Toast,
} from "konsta/react";
import { SheetTransaction } from "@/app/services/spreadsheet/types";
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
import { CategoryIcon, categoryColor } from "./category-look";
import { DeleteConfirm, SwipeRow } from "./entry-actions";
import { AddedEntry, EntrySheet } from "./entry-sheet";
import { ReviewDeck } from "./review-deck";
import { useRefresh } from "./use-refresh";
import { usePopup } from "./use-popup";
import type { CategorySuggestion } from "@/app/services/categories/open-categories";
import { CategoryEntry, categoryList } from "@/app/services/categories/category-list";
import { formatDay, formatMonthLong, formatUsd } from "./format";

export type SerializableTransaction = Omit<SheetTransaction, "date"> & {
  date: string;
};

type SortOrder = "newest" | "oldest" | "largest";
type PeriodMode = "months" | "years" | "all";
type Tab = "summary" | "transactions" | "review";
const TABS: Tab[] = ["summary", "transactions", "review"];

const PAGE_SIZE = 25;

export function DashboardClient({
  transactions: raw,
  fetchedAt,
  categories: categoryEntries,
  suggestions,
}: {
  transactions: SerializableTransaction[];
  /** Server render time; the deterministic "now" for pace and projections. */
  fetchedAt: number;
  /**
   * The Category list: what Modify and the review deck offer, and which
   * Categories don't count as Spending (Money Movement).
   */
  categories: readonly CategoryEntry[];
  /** Category Suggestions waiting for review. */
  suggestions: CategorySuggestion[];
}) {
  const transactions = useMemo<SheetTransaction[]>(
    () => raw.map((t) => ({ ...t, date: new Date(t.date) })),
    [raw]
  );
  const now = useMemo(() => new Date(fetchedAt), [fetchedAt]);
  const { names: categoryNames, notSpending } = useMemo(
    () => categoryList(categoryEntries),
    [categoryEntries]
  );

  const months = useMemo(() => allMonthKeys(transactions), [transactions]);
  const years = useMemo(() => allYearKeys(transactions), [transactions]);
  // The filter offers the loaded list, so a just-approved Category shows up
  // at once, then any older Category still on rows but no longer listed.
  const categories = useMemo(
    () => [
      ...categoryNames,
      ...allCategories(transactions).filter((c) => !categoryNames.includes(c)),
    ],
    [categoryNames, transactions]
  );

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
  const [tab, setTab] = useState<Tab>(() => {
    const t = searchParams.get("tab");
    return TABS.includes(t as Tab) ? (t as Tab) : "summary";
  });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const { refresh, pending: refreshing, updated } = useRefresh(fetchedAt);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOrder>("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // By sheet row: the entry swiped open to show its actions, the entry being
  // modified, and the entry whose Delete is waiting for confirmation.
  const [swipedRow, setSwipedRow] = useState<number | null>(null);
  const [modifyRow, setModifyRow] = useState<number | null>(null);
  const [confirmRow, setConfirmRow] = useState<number | null>(null);
  // Add Entry: whether its sheet is open; the entry just added, waiting for
  // the refreshed rows to include it (only rows past `after` can be it); the
  // row then highlighted; and the note shown when the filters hide it.
  const [adding, setAdding] = useState(false);
  const [justAdded, setJustAdded] = useState<(AddedEntry & { after: number }) | null>(null);
  const [highlightRow, setHighlightRow] = useState<number | null>(null);
  const [hiddenNote, setHiddenNote] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (period !== defaultPeriod) params.set("w", period);
    if (type !== "all") params.set("t", type);
    if (category !== "all") params.set("c", category);
    if (tab !== "summary") params.set("tab", tab);
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : location.pathname);
  }, [period, type, category, tab, defaultPeriod]);

  const filter = useMemo<DashboardFilter>(
    () => ({ window: period, type, category }),
    [period, type, category]
  );

  const mode: PeriodMode =
    period === "all" ? "all" : isYearKey(period) ? "years" : "months";
  const yearly = mode === "years";
  const unit = yearly ? "year" : "month";

  const stats = useMemo(
    () => paceStats(transactions, filter, notSpending, now),
    [transactions, filter, notSpending, now]
  );
  const pace = useMemo(
    () => cumulativePace(transactions, filter, notSpending, now),
    [transactions, filter, notSpending, now]
  );
  const trend = useMemo(
    () => (mode === "all" ? spendingOverTime(transactions, filter, notSpending) : []),
    [transactions, filter, notSpending, mode]
  );
  const movers = useMemo(
    () => biggestMovers(transactions, filter, notSpending, now),
    [transactions, filter, notSpending, now]
  );
  const breakdown = useMemo(
    () => categoryBreakdown(transactions, filter, notSpending),
    [transactions, filter, notSpending]
  );
  const merchants = useMemo(
    () => topMerchants(transactions, filter, notSpending),
    [transactions, filter, notSpending]
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

  // Once the refreshed rows include the entry just added (appended, so the
  // last matching row), highlight it. Give up quietly if it never shows.
  useEffect(() => {
    if (justAdded === null) return;
    const match = transactions
      .filter(
        (t) =>
          t.row > justAdded.after &&
          t.type === justAdded.type &&
          t.motive === justAdded.motive &&
          t.amount === justAdded.amount
      )
      .sort((a, b) => b.row - a.row)[0];
    if (match) {
      setJustAdded(null);
      setHighlightRow(match.row);
      return;
    }
    const id = setTimeout(() => setJustAdded(null), 15_000);
    return () => clearTimeout(id);
  }, [justAdded, transactions]);

  // Bring the highlighted entry into view (showing more rows if it's further
  // down) and flash it; if the current filters hide it, say so instead.
  useEffect(() => {
    if (highlightRow === null) return;
    const index = listed.findIndex((t) => t.row === highlightRow);
    if (index === -1) {
      const t = transactions.find((t) => t.row === highlightRow);
      setHiddenNote(t ? `Added for ${formatDay(t.date)} · not in this view` : null);
      setHighlightRow(null);
      return;
    }
    // The list lives on the Transactions tab: go there to show the entry.
    if (tab !== "transactions") {
      setTab("transactions");
      return; // runs again once the tab is rendered
    }
    if (index >= visibleCount) {
      setVisibleCount(index + 1);
      return; // runs again once the row is rendered
    }
    document
      .querySelector(`[data-row="${highlightRow}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    const id = setTimeout(() => setHighlightRow(null), 2500);
    return () => clearTimeout(id);
  }, [highlightRow, listed, transactions, visibleCount, tab]);

  useEffect(() => {
    if (hiddenNote === null) return;
    const id = setTimeout(() => setHiddenNote(null), 3500);
    return () => clearTimeout(id);
  }, [hiddenNote]);

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

  const periodTitle =
    mode === "all" ? "All Time" : yearly ? period : formatMonthLong(period).split(" ")[0];
  const periodNote =
    mode === "all"
      ? null
      : yearly
        ? isCurrent
          ? "Year to date"
          : "Full year"
        : isCurrent
          ? `${formatMonthLong(period)} · day ${elapsedDays} of ${totalDays}`
          : formatMonthLong(period);
  const spentLabel =
    mode === "all"
      ? "Spent all time"
      : isCurrent
        ? `Spent so far this ${unit}`
        : yearly
          ? `Spent in ${period}`
          : "Spent this month";

  const openAdd = () => {
    setSwipedRow(null);
    setAdding(true);
  };
  const modifying = listed.find((t) => t.row === modifyRow);
  const confirming = listed.find((t) => t.row === confirmRow);

  // Navbar buttons shared by every tab.
  const refreshButton = (
    <Link onClick={refresh} aria-label="Refresh" className={refreshing ? "pointer-events-none" : ""}>
      <RefreshCw size={20} className={refreshing ? "animate-spin" : ""} />
    </Link>
  );
  const filterButton = (
    <Link onClick={() => setFiltersOpen(true)} aria-label="Filters">
      <ListFilter size={22} />
    </Link>
  );
  const addButton = (
    <Link onClick={openAdd} aria-label="Add an entry">
      <Plus size={24} />
    </Link>
  );
  const rightButtons = (...buttons: React.ReactNode[]) => (
    <span className="flex items-center gap-4">
      {buttons.map((b, i) => (
        <Fragment key={i}>{b}</Fragment>
      ))}
    </span>
  );

  // Chips for the filters in force; each clears its own.
  const filterChips = (type !== "all" || category !== "all") && (
    <Block className="my-3 flex flex-wrap gap-2">
      {type !== "all" && (
        <Chip deleteButton onDelete={() => setType("all")}>
          {type}
        </Chip>
      )}
      {category !== "all" && (
        <Chip deleteButton onDelete={() => setCategory("all")}>
          {category}
        </Chip>
      )}
    </Block>
  );

  const summary = (
    <>
      {filterChips}
      {periodNote && <BlockFooter className="-mb-4 mt-2">{periodNote}</BlockFooter>}
      <List strong inset>
        <li className="px-4 pb-3 pt-4">
          <p className="text-[15px] font-medium opacity-55">{spentLabel}</p>
          <p className="text-[40px] font-bold leading-tight tracking-tight tabular-nums">
            {formatUsd(stats.spending)}
          </p>
          {vsLast !== null && (
            <p
              className="text-[15px] font-semibold"
              style={{ color: vsLast > 0 ? "#FF3B30" : "#34C759" }}
            >
              {vsLast >= 0 ? "▲" : "▼"} {formatUsd(Math.abs(vsLast))}{" "}
              <span className="font-normal opacity-60" style={{ color: "initial" }}>
                vs. last {unit}
                {isCurrent ? " at this point" : ""}
              </span>
            </p>
          )}
          <div className="mt-3">
            {mode === "all" ? (
              <MonthlyTrendChart data={trend} />
            ) : (
              <PaceChart data={pace} yearly={yearly} />
            )}
          </div>
          <p className="mt-1 flex gap-4 text-xs opacity-55">
            {mode === "all" ? (
              <span>Spending by month</span>
            ) : (
              <>
                <span>
                  <span className="text-primary">●</span> This {unit}
                </span>
                <span>
                  <span className="text-[#AEAEB2]">●</span> Last {unit}
                </span>
              </>
            )}
          </p>
        </li>
      </List>

      <List strong inset>
        {statStrip.flat().map(([label, value]) => (
          <ListItem key={label} title={label} after={<span className="tabular-nums">{value}</span>} />
        ))}
      </List>

      {movers.length > 0 && (
        <>
          <BlockTitle>Where It Moved</BlockTitle>
          <List strong inset>
            {movers.map((m) => (
              <ListItem
                key={m.category}
                media={<CategoryIcon category={m.category} />}
                title={m.category}
                after={
                  <span
                    className="tabular-nums"
                    style={{ color: m.delta > 0 ? "#FF3B30" : "#34C759" }}
                  >
                    {m.delta >= 0 ? "+" : "−"}
                    {formatUsd(Math.abs(m.delta))}
                  </span>
                }
              />
            ))}
          </List>
        </>
      )}

      <BlockTitle>Spending by Category</BlockTitle>
      <List strong inset>
        {breakdown.length === 0 && <ListItem title={<EmptyNote />} />}
        {breakdown.slice(0, 10).map((c) => (
          <ListItem
            key={c.category}
            media={<CategoryIcon category={c.category} />}
            title={c.category}
            after={<span className="tabular-nums">{formatUsd(c.amount)}</span>}
            text={
              <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max((c.amount / breakdown[0].amount) * 100, 2)}%`,
                    background: categoryColor(c.category),
                  }}
                />
              </span>
            }
          />
        ))}
      </List>

      <BlockTitle>Top Merchants</BlockTitle>
      <List strong inset>
        {merchants.length === 0 && <ListItem title={<EmptyNote />} />}
        {merchants.map((m, i) => (
          <ListItem
            key={m.merchant}
            media={<span className="w-5 text-right text-[15px] opacity-40">{i + 1}</span>}
            title={m.merchant}
            after={
              <span className="flex gap-3 tabular-nums">
                <span className="opacity-60">×{m.count}</span>
                {formatUsd(m.amount)}
              </span>
            }
          />
        ))}
      </List>
    </>
  );

  // Newest/oldest group by day like the iOS Wallet list; largest is one list.
  const shown = listed.slice(0, visibleCount);
  const groups: [string, typeof shown][] = [];
  for (const t of shown) {
    const key = sort === "largest" ? `${listed.length} entries` : formatDay(t.date);
    const last = groups[groups.length - 1];
    if (last && last[0] === key) last[1].push(t);
    else groups.push([key, [t]]);
  }

  const transactionsTab = (
    <>
      <Block className="my-3 flex flex-wrap gap-2">
        <Chip onClick={() => setTab("summary")}>{periodNote ?? "All time"}</Chip>
        {type !== "all" && (
          <Chip deleteButton onDelete={() => setType("all")}>
            {type}
          </Chip>
        )}
        {category !== "all" && (
          <Chip deleteButton onDelete={() => setCategory("all")}>
            {category}
          </Chip>
        )}
      </Block>
      {listed.length === 0 && (
        <List strong inset>
          <ListItem title={<EmptyNote />} />
        </List>
      )}
      {groups.map(([label, rows]) => (
        <div key={label}>
          <BlockTitle>{label}</BlockTitle>
          <List strong inset>
            {rows.map((t) => (
              <li
                key={t.row}
                data-row={t.row}
                className="transition-colors duration-700"
                style={{ background: highlightRow === t.row ? "rgba(0,122,255,.18)" : undefined }}
              >
                <SwipeRow
                  open={swipedRow === t.row}
                  onOpenChange={(open) => setSwipedRow(open ? t.row : null)}
                  onModify={() => {
                    setSwipedRow(null);
                    setConfirmRow(null);
                    setModifyRow(t.row);
                  }}
                  onDelete={() => {
                    setSwipedRow(null);
                    setConfirmRow(t.row);
                  }}
                  label={`${t.merchant}, ${formatUsd(t.amount)}`}
                >
                  <ListItem
                    component="div"
                    media={<CategoryIcon category={t.category} />}
                    title={<span title={t.motive}>{t.merchant}</span>}
                    footer={sort === "largest" ? `${t.category} · ${formatDay(t.date)}` : t.category}
                    after={
                      <span
                        className={`tabular-nums ${
                          t.type === "Income" ? "text-[#34C759]" : "text-black dark:text-white"
                        }`}
                      >
                        {t.type === "Income" ? "+" : "−"}
                        {formatUsd(t.amount)}
                      </span>
                    }
                  />
                </SwipeRow>
              </li>
            ))}
          </List>
        </div>
      ))}
      {listed.length > visibleCount && (
        <List strong inset>
          <ListButton onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
            Show More ({listed.length - visibleCount} remaining)
          </ListButton>
        </List>
      )}
    </>
  );

  const navbar =
    tab === "summary" ? (
      <Navbar
        large
        title={periodTitle}
        subtitle={updated ?? undefined}
        left={refreshButton}
        right={rightButtons(filterButton, addButton)}
        subnavbar={
          <div className="flex w-full items-center gap-2">
            <Link
              onClick={() => stepPeriod(-1)}
              aria-label={`Previous ${unit}`}
              className={mode === "all" || periodIndex <= 0 ? "pointer-events-none opacity-30" : ""}
            >
              <ChevronLeft size={24} />
            </Link>
            <Segmented strong className="flex-1">
              {(["months", "years", "all"] as const).map((m) => (
                <SegmentedButton key={m} active={mode === m} onClick={() => changeMode(m)}>
                  {m === "all" ? "All" : m === "months" ? "Months" : "Years"}
                </SegmentedButton>
              ))}
            </Segmented>
            <Link
              onClick={() => stepPeriod(1)}
              aria-label={`Next ${unit}`}
              className={
                mode === "all" || periodIndex >= siblings.length - 1
                  ? "pointer-events-none opacity-30"
                  : ""
              }
            >
              <ChevronRight size={24} />
            </Link>
          </div>
        }
      />
    ) : tab === "transactions" ? (
      <Navbar
        large
        title="Transactions"
        subtitle={updated ?? undefined}
        left={refreshButton}
        right={rightButtons(
          <Link onClick={() => setSortOpen(true)} aria-label="Sort">
            <ArrowUpDown size={21} />
          </Link>,
          filterButton,
          addButton
        )}
        subnavbar={
          <Searchbar
            placeholder="Search merchant or category"
            value={search}
            clearButton
            onInput={(e: React.ChangeEvent<HTMLInputElement>) => {
              setSearch(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            onClear={() => {
              setSearch("");
              setVisibleCount(PAGE_SIZE);
            }}
          />
        }
      />
    ) : (
      <Navbar
        large
        title="Review"
        subtitle={updated ?? undefined}
        left={refreshButton}
        right={addButton}
      />
    );

  return (
    // A phone-width column on wide screens, like the dashboard always was.
    <App theme="ios" safeAreas className="mx-auto max-w-2xl md:shadow-2xl" style={{ height: "100dvh", minHeight: 0 }}>
      {/* A page per tab, so each keeps its own scroll and large title. */}
      <Page key={tab} className="pb-28">
        {navbar}
        {tab === "summary" && summary}
        {tab === "transactions" && transactionsTab}
        {tab === "review" && <ReviewDeck suggestions={suggestions} categories={categoryNames} />}
      </Page>

      <Tabbar labels icons className="absolute bottom-0 left-0">
        {(
          [
            ["summary", "Summary", <ChartPie key="i" size={24} />],
            ["transactions", "Transactions", <ListIcon key="i" size={24} />],
            [
              "review",
              "Review",
              <span key="i" className="relative">
                <Inbox size={24} />
                {suggestions.length > 0 && (
                  <Badge className="absolute -right-3 -top-1.5" colors={{ bg: "bg-[#FF3B30]" }}>
                    {suggestions.length}
                  </Badge>
                )}
              </span>,
            ],
          ] as const
        ).map(([key, label, icon]) => (
          <TabbarLink
            key={key}
            active={tab === key}
            onClick={() => {
              setSwipedRow(null);
              setTab(key);
            }}
            icon={icon}
            label={label}
          />
        ))}
      </Tabbar>

      {filtersOpen && (
        <FiltersPopup
          type={type}
          category={category}
          categories={categories}
          onType={setType}
          onCategory={(c) => {
            setCategory(c);
            setVisibleCount(PAGE_SIZE);
          }}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      <Actions opened={sortOpen} onBackdropClick={() => setSortOpen(false)}>
        <ActionsGroup>
          <ActionsLabel>Sort entries</ActionsLabel>
          {(["newest", "oldest", "largest"] as const).map((o) => (
            <ActionsButton
              key={o}
              bold={sort === o}
              onClick={() => {
                setSort(o);
                setSortOpen(false);
              }}
            >
              {o === "newest" ? "Newest First" : o === "oldest" ? "Oldest First" : "Largest First"}
            </ActionsButton>
          ))}
        </ActionsGroup>
        <ActionsGroup>
          <ActionsButton onClick={() => setSortOpen(false)} bold>
            Cancel
          </ActionsButton>
        </ActionsGroup>
      </Actions>

      {adding && (
        <EntrySheet
          mode="add"
          categories={categoryNames}
          onAdded={(entry) =>
            setJustAdded({ ...entry, after: Math.max(0, ...transactions.map((t) => t.row)) })
          }
          onClose={() => setAdding(false)}
        />
      )}
      {modifying && (
        <EntrySheet
          key={modifying.row}
          row={modifying.row}
          motive={modifying.motive}
          merchant={modifying.merchant}
          category={modifying.category}
          categories={categoryNames}
          amount={modifying.amount}
          type={modifying.type}
          date={modifying.date}
          onClose={() => setModifyRow(null)}
        />
      )}
      {confirming && (
        <DeleteConfirm
          key={confirming.row}
          row={confirming.row}
          motive={confirming.motive}
          merchant={confirming.merchant}
          amount={confirming.amount}
          type={confirming.type}
          dateLabel={formatDay(confirming.date)}
          onClose={() => setConfirmRow(null)}
        />
      )}

      <Toast position="center" opened={hiddenNote !== null} className="bottom-28">
        <span role="status">{hiddenNote}</span>
      </Toast>
    </App>
  );
}

/** Type and Category filters, shared by the Summary and Transactions tabs. */
function FiltersPopup({
  type,
  category,
  categories,
  onType,
  onCategory,
  onClose,
}: {
  type: DashboardFilter["type"];
  category: string;
  categories: readonly string[];
  onType: (t: DashboardFilter["type"]) => void;
  onCategory: (c: string) => void;
  onClose: () => void;
}) {
  const { opened, close } = usePopup(onClose);
  const tick = (on: boolean) => (on ? <Check size={20} className="text-primary" /> : null);
  return (
    <Popup opened={opened} onBackdropClick={close}>
      <Page>
        <Navbar
          title="Filters"
          left={
            <Link
              onClick={() => {
                onType("all");
                onCategory("all");
              }}
            >
              Reset
            </Link>
          }
          right={
            <Link onClick={close} className="font-semibold">
              Done
            </Link>
          }
        />
        <div className="mx-auto max-w-2xl pb-10">
          <Block className="mt-4">
            <Segmented strong>
              {(["all", "Expense", "Income"] as const).map((t) => (
                <SegmentedButton key={t} active={type === t} onClick={() => onType(t)}>
                  {t === "all" ? "All Types" : t}
                </SegmentedButton>
              ))}
            </Segmented>
          </Block>
          <BlockTitle>Category</BlockTitle>
          <List strong inset>
            <ListItem
              link
              chevron={false}
              title="All Categories"
              after={tick(category === "all")}
              onClick={() => onCategory("all")}
            />
            {categories.map((c) => (
              <ListItem
                key={c}
                link
                chevron={false}
                media={<CategoryIcon category={c} />}
                title={c}
                after={tick(category === c)}
                onClick={() => onCategory(c)}
              />
            ))}
          </List>
        </div>
      </Page>
    </Popup>
  );
}

function EmptyNote() {
  return <span className="opacity-50">Nothing here for this filter.</span>;
}
