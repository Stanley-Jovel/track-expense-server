"use client";

// PROTOTYPE — throwaway. See page.tsx for the question and the variants.

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDownRight, ArrowLeftRight, ArrowUpRight, Banknote, Bus, ChartPie, Check,
  ChevronDown, ChevronRight, CircleUser, Clapperboard, Coffee, Dumbbell, Gift,
  GraduationCap, HeartHandshake, House, Inbox, Landmark, List, PanelLeft, PiggyBank,
  Pill, Plane, Plus, Receipt, Repeat, Search, Shield, Shirt, ShoppingBag,
  ShoppingCart, Sofa, Sparkles, Tag, Trash2, UtensilsCrossed, Wifi, Zap,
  type LucideIcon,
} from "lucide-react";
import {
  DashboardFilter, PacePoint, allMonthKeys, categoryBreakdown, cumulativePace,
  filterTransactions, paceStats, topMerchants,
} from "@/app/services/analytics/aggregate";
import { merchantName } from "@/app/services/analytics/merchant";
import { CategoryEntry, categoryList } from "@/app/services/categories/category-list";
import type { CategorySuggestion } from "@/app/services/categories/open-categories";
import { SheetTransaction } from "@/app/services/spreadsheet/types";
import { PrototypeSwitcher } from "@/components/prototype-switcher";
import { formatMonthLong, formatUsd } from "@/app/dashboard/format";

type Raw = Omit<SheetTransaction, "date"> & { date: string };
type Row = SheetTransaction & { merchant: string };

const VARIANTS = [
  { key: "A", name: "iPhone · stock SwiftUI" },
  { key: "B", name: "iPhone · Apple Card style" },
  { key: "C", name: "macOS · split view" },
];

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro", system-ui, sans-serif';
const BLUE = "#007AFF";
const GREEN = "#34C759";
const RED = "#FF3B30";
const GRAY = "#8E8E93";
const GROUPED_BG = "#F2F2F7";
const SEP = "rgba(60,60,67,.18)";

// SF Symbol stand-ins: an icon + system colour per Category.
const CATEGORY_LOOK: Record<string, [LucideIcon, string]> = {
  "Rent / Mortgage": [House, "#5856D6"],
  Utilities: [Zap, "#FFCC00"],
  "Internet & Phone": [Wifi, "#32ADE6"],
  "Home Maintenance & Furnishings": [Sofa, "#A2845E"],
  Groceries: [ShoppingCart, "#34C759"],
  "Dining Out": [UtensilsCrossed, "#FF9500"],
  "Coffee & Quick Bites": [Coffee, "#AC7F5E"],
  "Local Transportation": [Bus, "#007AFF"],
  Travel: [Plane, "#5AC8FA"],
  "Medical & Pharmacy": [Pill, "#FF3B30"],
  "Fitness & Wellness": [Dumbbell, "#30B0C7"],
  "Personal Care": [Sparkles, "#FF2D55"],
  "Shopping — General": [ShoppingBag, "#AF52DE"],
  Clothing: [Shirt, "#BF5AF2"],
  Entertainment: [Clapperboard, "#FF6482"],
  Subscriptions: [Repeat, "#5E5CE6"],
  Insurance: [Shield, "#64D2FF"],
  Taxes: [Landmark, "#8E8E93"],
  Education: [GraduationCap, "#0A84FF"],
  Gifts: [Gift, "#FF375F"],
  "Donations / Charity": [HeartHandshake, "#FF453A"],
  "Investments & Savings": [PiggyBank, "#30D158"],
  Transfers: [ArrowLeftRight, "#636366"],
  "Bank & FX Fees": [Receipt, "#98989D"],
  Income: [Banknote, "#34C759"],
};
const look = (c: string): [LucideIcon, string] => CATEGORY_LOOK[c] ?? [Tag, GRAY];

function CategoryIcon({ category, size = 29, round = false }: { category: string; size?: number; round?: boolean }) {
  const [Icon, color] = look(category);
  return (
    <span
      style={{
        width: size, height: size, borderRadius: round ? size : size * 0.24, background: color,
        display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      <Icon size={size * 0.58} color="#fff" strokeWidth={2.2} />
    </span>
  );
}

const hintName = (h: CategorySuggestion["hint"]) => (h ? (h.kind === "category" ? h.name : h.label) : "");
const usd0 = (n: number) => formatUsd(n).replace(/\.\d\d$/, "");
const shortDay = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const weekday = (d: Date) =>
  d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });

// ── data ────────────────────────────────────────────────────────────────────

function useData(raw: Raw[], entries: readonly CategoryEntry[], fetchedAt: number) {
  return useMemo(() => {
    const txs: SheetTransaction[] = raw.map((t) => ({ ...t, date: new Date(t.date) }));
    const now = new Date(fetchedAt);
    const { notSpending } = categoryList(entries);
    const months = allMonthKeys(txs);
    const month = months[months.length - 1] ?? "all";
    const filter: DashboardFilter = { window: month, type: "all", category: "all" };
    const rows: Row[] = filterTransactions(txs, filter)
      .map((t) => ({ ...t, merchant: merchantName(t.motive) }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    return {
      month,
      monthLabel: month === "all" ? "All time" : formatMonthLong(month),
      monthName: month === "all" ? "All time" : formatMonthLong(month).split(" ")[0],
      stats: paceStats(txs, filter, notSpending, now),
      pace: month === "all" ? [] : cumulativePace(txs, filter, notSpending, now),
      breakdown: categoryBreakdown(txs, filter, notSpending),
      merchants: topMerchants(txs, filter, notSpending).slice(0, 5),
      rows,
      categoryNames: categoryList(entries).names,
      notSpending,
    };
  }, [raw, entries, fetchedAt]);
}
type Data = ReturnType<typeof useData>;

function deltaVsLast(d: Data) {
  const prev = d.stats.previousAtSamePoint;
  if (!prev) return null;
  return (d.stats.spending - prev) / prev;
}

// ── Swift Charts look-alike ─────────────────────────────────────────────────

function PaceLine({ pace, w, h, color = BLUE, dark = false }: { pace: PacePoint[]; w: number; h: number; color?: string; dark?: boolean }) {
  if (pace.length === 0) return null;
  const max = Math.max(1, ...pace.map((p) => Math.max(p.current ?? 0, p.previous)));
  const x = (i: number) => (i / Math.max(1, pace.length - 1)) * (w - 36);
  const y = (v: number) => h - 18 - (v / max) * (h - 26);
  const path = (vals: (number | null)[]) =>
    vals
      .map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
      .filter(Boolean)
      .join(" L ");
  const cur = pace.map((p) => p.current);
  const lastIdx = cur.findLastIndex((v) => v != null);
  const grid = dark ? "rgba(255,255,255,.15)" : "rgba(60,60,67,.12)";
  const label = dark ? "rgba(255,255,255,.6)" : GRAY;
  return (
    <svg width={w} height={h} style={{ display: "block" }}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={0} x2={w - 36} y1={y(max * f)} y2={y(max * f)} stroke={grid} strokeDasharray={f ? "2 3" : undefined} />
          <text x={w - 32} y={y(max * f) + 4} fontSize={10} fill={label}>{usd0(max * f)}</text>
        </g>
      ))}
      <path d={`M ${path(pace.map((p) => p.previous))}`} fill="none" stroke={dark ? "rgba(255,255,255,.35)" : "#C7C7CC"} strokeWidth={2} strokeDasharray="4 4" />
      {lastIdx >= 0 && (
        <>
          <path d={`M 0,${y(0)} L ${path(cur)} L ${x(lastIdx)},${y(0)} Z`} fill={color} opacity={0.12} />
          <path d={`M ${path(cur)}`} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(lastIdx)} cy={y(cur[lastIdx]!)} r={4.5} fill={color} stroke="#fff" strokeWidth={2} />
        </>
      )}
      {[0, Math.floor((pace.length - 1) / 2), pace.length - 1].map((i) => (
        <text key={i} x={x(i)} y={h - 3} fontSize={10} fill={label} textAnchor={i === 0 ? "start" : i === pace.length - 1 ? "end" : "middle"}>
          {pace[i].unit}
        </text>
      ))}
    </svg>
  );
}

// ── device chrome ───────────────────────────────────────────────────────────

function IPhone({ children, bg = GROUPED_BG, darkStatus = false }: { children: React.ReactNode; bg?: string; darkStatus?: boolean }) {
  return (
    <div style={{ width: 393 + 24, height: 852 + 24, borderRadius: 68, background: "#1c1c1e", padding: 12, boxShadow: "0 30px 80px rgba(0,0,0,.35), inset 0 0 0 2px #3a3a3c" }}>
      <div style={{ position: "relative", width: 393, height: 852, borderRadius: 56, overflow: "clip", background: bg, fontFamily: SF, color: darkStatus ? "#fff" : "#000" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 54, zIndex: 50, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 34px 0 44px", fontWeight: 600, fontSize: 17, pointerEvents: "none" }}>
          <span>9:41</span>
          <span style={{ fontSize: 13, letterSpacing: 1 }}>●●● ▮</span>
        </div>
        <div style={{ position: "absolute", top: 11, left: "50%", transform: "translateX(-50%)", width: 124, height: 36, borderRadius: 20, background: "#000", zIndex: 60 }} />
        {children}
        <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", width: 140, height: 5, borderRadius: 3, background: darkStatus ? "#fff" : "#000", zIndex: 60 }} />
      </div>
    </div>
  );
}

function Sheet({ open, onClose, title, left = "Cancel", right, children }: { open: boolean; onClose: () => void; title: string; left?: string; right?: string; children: React.ReactNode }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.3)", opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none", transition: "opacity .3s", zIndex: 70 }} />
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, top: 60, background: GROUPED_BG, borderRadius: "38px 38px 0 0", transform: open ? "translateY(0)" : "translateY(105%)", visibility: open ? "visible" : "hidden", transition: "transform .38s cubic-bezier(.2,.9,.25,1), visibility .38s", zIndex: 80, overflow: "auto", paddingBottom: 40 }}>
        <div style={{ width: 36, height: 5, borderRadius: 3, background: "#C7C7CC", margin: "6px auto 0" }} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "10px 18px 6px" }}>
          <button onClick={onClose} style={{ color: BLUE, fontSize: 17, textAlign: "left" }}>{left}</button>
          <span style={{ fontWeight: 600, fontSize: 17 }}>{title}</span>
          {right ? <button onClick={onClose} style={{ color: BLUE, fontSize: 17, fontWeight: 600, textAlign: "right" }}>{right}</button> : <span />}
        </div>
        {children}
      </div>
    </>
  );
}

// Inset-grouped List section.
function Section({ header, footer, children }: { header?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ margin: "0 16px 24px" }}>
      {header && <div style={{ fontSize: 13, color: GRAY, textTransform: "uppercase", padding: "0 16px 7px" }}>{header}</div>}
      <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden" }}>{children}</div>
      {footer && <div style={{ fontSize: 13, color: GRAY, padding: "7px 16px 0" }}>{footer}</div>}
    </div>
  );
}

function Cell({ children, last, onClick, inset = 16 }: { children: React.ReactNode; last?: boolean; onClick?: () => void; inset?: number }) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 16px", minHeight: 44, cursor: onClick ? "pointer" : undefined, position: "relative" }}>
      {children}
      {!last && <div style={{ position: "absolute", bottom: 0, left: inset, right: 0, height: 0.5, background: SEP }} />}
    </div>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} style={{ width: 51, height: 31, borderRadius: 16, background: on ? GREEN : "#E9E9EB", position: "relative", transition: "background .2s", flexShrink: 0 }}>
      <span style={{ position: "absolute", top: 2, left: on ? 22 : 2, width: 27, height: 27, borderRadius: 14, background: "#fff", boxShadow: "0 3px 8px rgba(0,0,0,.15)", transition: "left .2s" }} />
    </button>
  );
}

function Segmented({ options, value, onChange, dark }: { options: string[]; value: string; onChange: (v: string) => void; dark?: boolean }) {
  return (
    <div style={{ display: "flex", background: dark ? "rgba(118,118,128,.24)" : "rgba(118,118,128,.12)", borderRadius: 9, padding: 2 }}>
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} style={{ flex: 1, padding: "6px 10px", borderRadius: 7, fontSize: 13, fontWeight: value === o ? 600 : 500, background: value === o ? (dark ? "#636366" : "#fff") : "transparent", boxShadow: value === o ? "0 3px 8px rgba(0,0,0,.12)" : undefined, color: "inherit" }}>
          {o}
        </button>
      ))}
    </div>
  );
}

// Shared Form for Modify / New Entry (the stock Form look; B and C reuse it).
function EntryForm({ row, categories }: { row?: Row; categories: readonly string[] }) {
  const [type, setType] = useState(row?.type ?? "Expense");
  const [all, setAll] = useState(true);
  return (
    <div style={{ paddingTop: 12 }}>
      {!row && (
        <div style={{ margin: "0 16px 20px" }}>
          <Segmented options={["Expense", "Income"]} value={type} onChange={(v) => setType(v as "Expense")} />
        </div>
      )}
      <Section>
        <Cell><span style={{ flex: 1, fontSize: 17 }}>{row ? row.motive : <span style={{ color: "#C7C7CC" }}>What was it for?</span>}</span></Cell>
        <Cell last><span style={{ fontSize: 34, fontWeight: 700, padding: "8px 0", fontVariantNumeric: "tabular-nums", color: row ? "#000" : "#C7C7CC" }}>{row ? formatUsd(row.amount) : "$0.00"}</span></Cell>
      </Section>
      <Section footer={row ? undefined : "Leave on Automatic to let the Merchant's override or the LLM choose."}>
        <Cell>
          <span style={{ flex: 1, fontSize: 17 }}>Category</span>
          <span style={{ color: GRAY, fontSize: 17, display: "flex", alignItems: "center", gap: 4 }}>
            {row ? row.category : "Automatic"} <ChevronDown size={14} />
          </span>
        </Cell>
        <Cell last>
          <span style={{ flex: 1, fontSize: 17 }}>Date</span>
          <span style={{ background: "rgba(118,118,128,.12)", borderRadius: 7, padding: "5px 11px", fontSize: 17 }}>{row ? shortDay(row.date) : "Today"}</span>
        </Cell>
      </Section>
      {row && row.type === "Expense" && (
        <Section footer={`Every past and future ${row.merchant} expense takes this Category.`}>
          <Cell last>
            <span style={{ flex: 1, fontSize: 17 }}>Use for all {row.merchant}</span>
            <Toggle on={all} onChange={setAll} />
          </Cell>
        </Section>
      )}
      {row && (
        <Section>
          <Cell last><span style={{ flex: 1, textAlign: "center", color: RED, fontSize: 17 }}>Delete Entry</span></Cell>
        </Section>
      )}
      <div style={{ display: "none" }}>{categories.length}</div>
    </div>
  );
}

// ── Variant A: stock SwiftUI (TabView, NavigationStack, inset-grouped List) ──

function VariantA({ d, suggestions }: { d: Data; suggestions: CategorySuggestion[] }) {
  const [tab, setTab] = useState<"summary" | "activity" | "review">("summary");
  const [selected, setSelected] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const delta = deltaVsLast(d);

  const byDay = useMemo(() => {
    const needle = query.toLowerCase();
    const groups = new Map<string, Row[]>();
    for (const r of d.rows) {
      if (needle && !`${r.merchant} ${r.category}`.toLowerCase().includes(needle)) continue;
      const k = `${weekday(r.date)}, ${shortDay(r.date)}`;
      groups.set(k, [...(groups.get(k) ?? []), r]);
    }
    return [...groups.entries()];
  }, [d.rows, query]);

  const largeTitle = (title: string, trailing?: React.ReactNode) => (
    <div style={{ padding: "58px 16px 0" }}>
      <div style={{ height: 44, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10 }}>{trailing}</div>
      <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: 0.37, margin: "0 4px 10px" }}>{title}</h1>
    </div>
  );
  const glassBtn = (child: React.ReactNode, onClick?: () => void) => (
    <button onClick={onClick} style={{ width: 44, height: 44, borderRadius: 22, background: "rgba(255,255,255,.75)", backdropFilter: "blur(20px)", boxShadow: "0 2px 12px rgba(0,0,0,.08), inset 0 0 0 .5px rgba(0,0,0,.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {child}
    </button>
  );

  return (
    <IPhone>
      <div style={{ position: "absolute", inset: 0, overflow: "auto", paddingBottom: 110 }}>
        {tab === "summary" && (
          <>
            {largeTitle(d.monthName, glassBtn(<Plus size={22} color="#000" />, () => setAdding(true)))}
            <Section>
              <div style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: 15, color: GRAY, fontWeight: 500 }}>Spending</div>
                <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: -0.5, fontVariantNumeric: "tabular-nums" }}>{formatUsd(d.stats.spending)}</div>
                {delta != null && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 15, fontWeight: 600, color: delta > 0 ? RED : GREEN }}>
                    {delta > 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    {Math.abs(Math.round(delta * 100))}% <span style={{ color: GRAY, fontWeight: 400 }}>vs. last month so far</span>
                  </div>
                )}
              </div>
              <div style={{ padding: "0 16px 14px" }}>
                <PaceLine pace={d.pace} w={329} h={150} />
                <div style={{ display: "flex", gap: 14, fontSize: 12, color: GRAY, marginTop: 6 }}>
                  <span><span style={{ color: BLUE }}>●</span> This month</span>
                  <span><span style={{ color: "#C7C7CC" }}>●</span> Last month</span>
                </div>
              </div>
            </Section>
            <Section>
              <Cell><span style={{ flex: 1, fontSize: 17 }}>Daily Average</span><span style={{ color: GRAY, fontSize: 17 }}>{formatUsd(d.stats.dailyAverage)}</span></Cell>
              <Cell><span style={{ flex: 1, fontSize: 17 }}>Projected</span><span style={{ color: GRAY, fontSize: 17 }}>{formatUsd(d.stats.projected)}</span></Cell>
              <Cell last><span style={{ flex: 1, fontSize: 17 }}>Money Movement</span><span style={{ color: GRAY, fontSize: 17 }}>{formatUsd(d.stats.moneyMovement)}</span></Cell>
            </Section>
            <Section header="Categories">
              {d.breakdown.slice(0, 8).map((c, i, a) => (
                <Cell key={c.category} last={i === a.length - 1} inset={57}>
                  <CategoryIcon category={c.category} />
                  <span style={{ flex: 1, fontSize: 17 }}>{c.category}</span>
                  <span style={{ color: GRAY, fontSize: 17, fontVariantNumeric: "tabular-nums" }}>{usd0(c.amount)}</span>
                  <ChevronRight size={16} color="#C4C4C6" />
                </Cell>
              ))}
            </Section>
            <Section header="Top Merchants">
              {d.merchants.map((m, i, a) => (
                <Cell key={m.merchant} last={i === a.length - 1}>
                  <span style={{ flex: 1, fontSize: 17 }}>{m.merchant}</span>
                  <span style={{ color: GRAY, fontSize: 15 }}>{m.count}×</span>
                  <span style={{ fontSize: 17, fontVariantNumeric: "tabular-nums", width: 70, textAlign: "right" }}>{usd0(m.amount)}</span>
                </Cell>
              ))}
            </Section>
          </>
        )}

        {tab === "activity" && (
          <>
            {largeTitle("Transactions", glassBtn(<Plus size={22} color="#000" />, () => setAdding(true)))}
            <div style={{ margin: "0 16px 18px", display: "flex", alignItems: "center", gap: 6, background: "rgba(118,118,128,.12)", borderRadius: 10, padding: "0 8px", height: 36 }}>
              <Search size={16} color={GRAY} />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" style={{ flex: 1, background: "transparent", outline: "none", fontSize: 17, fontFamily: SF }} />
            </div>
            {byDay.slice(0, 14).map(([day, rows]) => (
              <Section key={day} header={day}>
                {rows.map((r, i) => (
                  <Cell key={r.row} last={i === rows.length - 1} inset={57} onClick={() => setSelected(r)}>
                    <CategoryIcon category={r.category} />
                    <div style={{ flex: 1, minWidth: 0, padding: "10px 0" }}>
                      <div style={{ fontSize: 17, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.merchant}</div>
                      <div style={{ fontSize: 15, color: GRAY }}>{r.category}</div>
                    </div>
                    <span style={{ fontSize: 17, fontVariantNumeric: "tabular-nums", color: r.type === "Income" ? GREEN : "#000" }}>
                      {r.type === "Income" ? "+" : ""}{formatUsd(r.amount)}
                    </span>
                  </Cell>
                ))}
              </Section>
            ))}
          </>
        )}

        {tab === "review" && (
          <>
            {largeTitle("Review")}
            {suggestions.length === 0 && (
              <div style={{ textAlign: "center", color: GRAY, marginTop: 160 }}>
                <Inbox size={56} strokeWidth={1.4} style={{ margin: "0 auto 12px" }} />
                <div style={{ fontSize: 22, fontWeight: 700, color: "#000" }}>All Caught Up</div>
                <div style={{ fontSize: 15, marginTop: 4 }}>No Category Suggestions are waiting.</div>
              </div>
            )}
            {suggestions.map((s) => (
              <Section key={s.key} header={`${s.entries.length} entries · ${usd0(s.total)}`} footer={s.hint ? `Looks like ${hintName(s.hint)}.` : undefined}>
                <Cell>
                  <span style={{ flex: 1, fontSize: 20, fontWeight: 600, padding: "10px 0" }}>“{s.label}”</span>
                </Cell>
                {s.entries.slice(0, 3).map((e) => (
                  <Cell key={e.row}>
                    <span style={{ flex: 1, fontSize: 15 }}>{merchantName(e.motive)}</span>
                    <span style={{ fontSize: 15, color: GRAY }}>{formatUsd(e.amount)}</span>
                  </Cell>
                ))}
                <Cell><span style={{ color: BLUE, fontSize: 17 }}>Approve as Spending</span></Cell>
                {s.hint && <Cell><span style={{ color: BLUE, fontSize: 17 }}>No, it’s {hintName(s.hint)}</span></Cell>}
                <Cell><span style={{ color: BLUE, fontSize: 17 }}>It’s Another Category…</span></Cell>
                <Cell last><span style={{ color: RED, fontSize: 17 }}>Not a Category</span></Cell>
              </Section>
            ))}
          </>
        )}
      </div>

      {/* iOS 26 floating Liquid Glass tab bar */}
      <div style={{ position: "absolute", bottom: 26, left: 20, right: 20, display: "flex", gap: 10, zIndex: 40 }}>
        <div style={{ flex: 1, height: 62, borderRadius: 31, background: "rgba(255,255,255,.72)", backdropFilter: "blur(24px) saturate(1.8)", boxShadow: "0 8px 30px rgba(0,0,0,.12), inset 0 0 0 .5px rgba(0,0,0,.08)", display: "flex", padding: 4 }}>
          {([["summary", "Summary", ChartPie], ["activity", "Transactions", List], ["review", "Review", Inbox]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flex: 1, borderRadius: 27, background: tab === k ? "rgba(0,0,0,.06)" : "transparent", color: tab === k ? BLUE : "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, fontSize: 10, fontWeight: 500, position: "relative" }}>
              <Icon size={22} strokeWidth={tab === k ? 2.4 : 1.8} />
              {label}
              {k === "review" && suggestions.length > 0 && (
                <span style={{ position: "absolute", top: 4, right: "calc(50% - 22px)", background: RED, color: "#fff", fontSize: 12, fontWeight: 600, minWidth: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{suggestions.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <Sheet open={selected != null} onClose={() => setSelected(null)} title="Modify" right="Save">
        {selected && <EntryForm key={selected.row} row={selected} categories={d.categoryNames} />}
      </Sheet>
      <Sheet open={adding} onClose={() => setAdding(false)} title="New Entry" right="Add">
        <EntryForm key={String(adding)} categories={d.categoryNames} />
      </Sheet>
    </IPhone>
  );
}

// ── Variant B: Apple Card style (one hero card, tiles, activity bars) ───────

function VariantB({ d, suggestions }: { d: Data; suggestions: CategorySuggestion[] }) {
  const [selected, setSelected] = useState<Row | null>(null);
  const [adding, setAdding] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [span, setSpan] = useState("Weekly");
  const delta = deltaVsLast(d);

  // Stacked bars: spending per week (or per day, last 7) by top Categories.
  const top = d.breakdown.slice(0, 5).map((c) => c.category);
  const bars = useMemo(() => {
    const spend = d.rows.filter((r) => r.type === "Expense" && !d.notSpending.includes(r.category));
    const buckets = new Map<string, Map<string, number>>();
    const keyOf = (r: Row) => (span === "Weekly" ? `W${Math.floor((r.date.getUTCDate() - 1) / 7) + 1}` : String(r.date.getUTCDate()));
    const keys =
      span === "Weekly"
        ? ["W1", "W2", "W3", "W4", "W5"]
        : [...new Set(spend.map((r) => String(r.date.getUTCDate())))].sort((a, b) => +a - +b).slice(-7);
    keys.forEach((k) => buckets.set(k, new Map()));
    for (const r of spend) {
      const b = buckets.get(keyOf(r));
      if (!b) continue;
      const c = top.includes(r.category) ? r.category : "Other";
      b.set(c, (b.get(c) ?? 0) + r.amount);
    }
    return [...buckets.entries()].map(([k, m]) => ({ k, parts: [...top, "Other"].map((c) => [c, m.get(c) ?? 0] as const), total: [...m.values()].reduce((a, b) => a + b, 0) }));
  }, [d.rows, d.notSpending, span, top]);
  const maxBar = Math.max(1, ...bars.map((b) => b.total));

  const tile: React.CSSProperties = { background: "#fff", borderRadius: 22, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,.04)" };

  return (
    <IPhone bg="#F2F2F7">
      <div style={{ position: "absolute", inset: 0, overflow: "auto", padding: "60px 16px 120px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "8px 4px 16px" }}>
          <span style={{ fontSize: 28, fontWeight: 700 }}>Expenses</span>
          <CircleUser size={30} color={BLUE} strokeWidth={1.6} />
        </div>

        {/* the card */}
        <div style={{ height: 210, borderRadius: 18, padding: 20, color: "#fff", position: "relative", overflow: "hidden", background: "conic-gradient(from 210deg at 70% 30%, #ff9a5a, #ff5e8a, #a46bff, #3fb5ff, #48e0b0, #ffd45a, #ff9a5a)", boxShadow: "0 18px 40px rgba(120,80,200,.35)" }}>
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(160deg, rgba(255,255,255,.35), rgba(255,255,255,0) 50%)" }} />
          <div style={{ position: "relative", display: "flex", flexDirection: "column", height: "100%" }}>
            <div style={{ fontSize: 15, fontWeight: 600, opacity: 0.9 }}>{d.monthLabel}</div>
            <div style={{ flex: 1 }} />
            <div style={{ fontSize: 13, opacity: 0.85 }}>Spent so far</div>
            <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1, fontVariantNumeric: "tabular-nums" }}>{formatUsd(d.stats.spending)}</div>
          </div>
        </div>

        {/* two tiles, like Card Balance / Payment Due */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          <div style={tile}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Projected</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{usd0(d.stats.projected)}</div>
            <div style={{ fontSize: 13, color: GRAY, marginTop: 2 }}>{formatUsd(d.stats.dailyAverage)}/day</div>
          </div>
          <div style={tile}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>vs. Last Month</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4, color: delta == null ? "#000" : delta > 0 ? RED : GREEN }}>
              {delta == null ? "—" : `${delta > 0 ? "+" : "−"}${Math.abs(Math.round(delta * 100))}%`}
            </div>
            <div style={{ fontSize: 13, color: GRAY, marginTop: 2 }}>{d.stats.previousAtSamePoint != null ? `${usd0(d.stats.previousAtSamePoint)} by now` : "no data"}</div>
          </div>
        </div>

        {suggestions.length > 0 && (
          <button onClick={() => setReviewing(true)} style={{ ...tile, marginTop: 12, width: "100%", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
            <span style={{ width: 40, height: 40, borderRadius: 20, background: "#FF9500", display: "flex", alignItems: "center", justifyContent: "center" }}><Sparkles size={20} color="#fff" /></span>
            <span style={{ flex: 1 }}>
              <span style={{ display: "block", fontSize: 15, fontWeight: 600 }}>{suggestions.length} new {suggestions.length === 1 ? "category" : "categories"} to review</span>
              <span style={{ fontSize: 13, color: GRAY }}>“{suggestions[0].label}” and more</span>
            </span>
            <ChevronRight size={18} color="#C4C4C6" />
          </button>
        )}

        {/* activity */}
        <div style={{ ...tile, marginTop: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 17, fontWeight: 700 }}>{span} Activity</span>
            <div style={{ width: 150 }}><Segmented options={["Weekly", "Daily"]} value={span} onChange={setSpan} /></div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 130 }}>
            {bars.map((b) => (
              <div key={b.k} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{ width: "100%", maxWidth: 30, height: 110, display: "flex", flexDirection: "column-reverse", borderRadius: 6, overflow: "hidden", background: "#F2F2F7" }}>
                  {b.parts.map(([c, v]) => v > 0 && <div key={c} style={{ height: `${(v / maxBar) * 100}%`, background: c === "Other" ? "#D1D1D6" : look(c)[1] }} />)}
                </div>
                <span style={{ fontSize: 11, color: GRAY }}>{b.k}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 14 }}>
            {d.breakdown.slice(0, 5).map((c) => (
              <span key={c.category} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                <span style={{ width: 9, height: 9, borderRadius: 5, background: look(c.category)[1] }} />
                {c.category} <span style={{ color: GRAY }}>{usd0(c.amount)}</span>
              </span>
            ))}
          </div>
        </div>

        {/* latest */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "22px 4px 8px" }}>
          <span style={{ fontSize: 22, fontWeight: 700 }}>Latest Transactions</span>
          <span style={{ color: BLUE, fontSize: 15 }}>See All</span>
        </div>
        <div style={{ ...tile, padding: "4px 0" }}>
          {d.rows.slice(0, 8).map((r, i, a) => (
            <div key={r.row} onClick={() => setSelected(r)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", cursor: "pointer", position: "relative" }}>
              <CategoryIcon category={r.category} size={40} round />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.merchant}</div>
                <div style={{ fontSize: 13, color: GRAY }}>{r.category}</div>
                <div style={{ fontSize: 13, color: GRAY }}>{weekday(r.date)}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: r.type === "Income" ? GREEN : "#000" }}>{r.type === "Income" ? "+" : ""}{formatUsd(r.amount)}</div>
                <ChevronRight size={16} color="#C4C4C6" style={{ marginLeft: "auto" }} />
              </div>
              {i < a.length - 1 && <div style={{ position: "absolute", bottom: 0, left: 68, right: 0, height: 0.5, background: SEP }} />}
            </div>
          ))}
        </div>
      </div>

      <button onClick={() => setAdding(true)} style={{ position: "absolute", right: 22, bottom: 34, width: 60, height: 60, borderRadius: 30, background: "#000", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 10px 26px rgba(0,0,0,.3)", zIndex: 40 }}>
        <Plus size={28} />
      </button>

      <Sheet open={selected != null} onClose={() => setSelected(null)} title="Transaction" right="Save">
        {selected && (
          <div>
            <div style={{ textAlign: "center", padding: "18px 0 6px" }}>
              <CategoryIcon category={selected.category} size={64} round />
              <div style={{ fontSize: 40, fontWeight: 700, marginTop: 10 }}>{formatUsd(selected.amount)}</div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{selected.merchant}</div>
              <div style={{ fontSize: 15, color: GRAY }}>{weekday(selected.date)}, {shortDay(selected.date)}</div>
            </div>
            <EntryForm key={selected.row} row={selected} categories={d.categoryNames} />
          </div>
        )}
      </Sheet>
      <Sheet open={adding} onClose={() => setAdding(false)} title="New Entry" right="Add">
        <EntryForm key={String(adding)} categories={d.categoryNames} />
      </Sheet>
      <Sheet open={reviewing} onClose={() => setReviewing(false)} title="Review" left="Done">
        <ReviewDeck suggestions={suggestions} />
      </Sheet>
    </IPhone>
  );
}

// One card at a time; big stacked buttons (like the web review deck, but native).
function ReviewDeck({ suggestions }: { suggestions: CategorySuggestion[] }) {
  const [i, setI] = useState(0);
  const s = suggestions[i];
  if (!s) return <div style={{ textAlign: "center", color: GRAY, marginTop: 120 }}><Check size={48} style={{ margin: "0 auto 8px" }} />All caught up</div>;
  const btn = (label: string, primary?: boolean, danger?: boolean) => (
    <button onClick={() => setI(i + 1)} style={{ width: "100%", height: 50, borderRadius: 25, marginTop: 10, fontSize: 17, fontWeight: 600, background: primary ? BLUE : "rgba(118,118,128,.12)", color: primary ? "#fff" : danger ? RED : BLUE }}>
      {label}
    </button>
  );
  return (
    <div style={{ padding: "16px 20px" }}>
      <div style={{ textAlign: "center", fontSize: 13, color: GRAY, marginBottom: 12 }}>{i + 1} of {suggestions.length}</div>
      <div style={{ background: "#fff", borderRadius: 22, padding: 20, boxShadow: "0 10px 30px rgba(0,0,0,.08)" }}>
        <div style={{ fontSize: 13, color: GRAY }}>The LLM suggests a new category</div>
        <div style={{ fontSize: 28, fontWeight: 700, margin: "4px 0 12px" }}>{s.label}</div>
        {s.entries.slice(0, 4).map((e) => (
          <div key={e.row} style={{ display: "flex", justifyContent: "space-between", fontSize: 15, padding: "6px 0", borderTop: `0.5px solid ${SEP}` }}>
            <span>{merchantName(e.motive)}</span><span style={{ color: GRAY }}>{formatUsd(e.amount)}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 18 }}>
        {btn("Add Category", true)}
        {s.hint && btn(`No, it’s ${hintName(s.hint)}`)}
        {btn("It’s Another Category…")}
        {btn("Not a Category", false, true)}
      </div>
    </div>
  );
}

// ── Variant C: macOS (NavigationSplitView + Table + inspector) ──────────────

function VariantC({ d, suggestions }: { d: Data; suggestions: CategorySuggestion[] }) {
  const [filter, setFilter] = useState<string>("all");
  const [selectedRow, setSelectedRow] = useState<number | null>(d.rows[0]?.row ?? null);
  const [query, setQuery] = useState("");
  const rows = d.rows.filter(
    (r) =>
      (filter === "all" || r.category === filter) &&
      (!query || `${r.merchant} ${r.category}`.toLowerCase().includes(query.toLowerCase()))
  );
  const selected = d.rows.find((r) => r.row === selectedRow) ?? null;
  const delta = deltaVsLast(d);
  const MAC = { sel: "#0A64D8", side: "rgba(232,232,237,.85)", rule: "rgba(0,0,0,.1)", alt: "#F4F5F5" };

  const sideItem = (key: string, label: string, icon: React.ReactNode, trailing?: React.ReactNode) => (
    <div key={key} onClick={() => setFilter(key)} style={{ display: "flex", alignItems: "center", gap: 7, height: 26, padding: "0 8px", margin: "0 10px", borderRadius: 6, cursor: "default", background: filter === key ? "rgba(0,0,0,.09)" : "transparent", fontSize: 13 }}>
      {icon}
      <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</span>
      {trailing}
    </div>
  );

  return (
    <div style={{ width: 1180, height: 740, borderRadius: 12, overflow: "hidden", fontFamily: SF, color: "#1d1d1f", background: "#fff", boxShadow: "0 40px 100px rgba(0,0,0,.35), 0 0 0 .5px rgba(0,0,0,.3)", display: "flex", fontSize: 13 }}>
      {/* sidebar */}
      <div style={{ width: 230, background: MAC.side, backdropFilter: "blur(30px)", borderRight: `0.5px solid ${MAC.rule}`, display: "flex", flexDirection: "column", overflow: "auto" }}>
        <div style={{ height: 52, display: "flex", alignItems: "center", gap: 8, padding: "0 18px", flexShrink: 0 }}>
          {["#FF5F57", "#FEBC2E", "#28C840"].map((c) => <span key={c} style={{ width: 12, height: 12, borderRadius: 6, background: c }} />)}
          <span style={{ flex: 1 }} />
          <PanelLeft size={16} color={GRAY} />
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: GRAY, padding: "8px 18px 4px" }}>Library</div>
        {sideItem("all", "All Transactions", <List size={15} color={BLUE} />, <span style={{ color: GRAY }}>{d.rows.length}</span>)}
        {sideItem("review", "Review", <Inbox size={15} color={BLUE} />, suggestions.length > 0 && <span style={{ background: "rgba(0,0,0,.1)", borderRadius: 8, padding: "0 6px", fontSize: 11, fontWeight: 600 }}>{suggestions.length}</span>)}
        <div style={{ fontSize: 11, fontWeight: 600, color: GRAY, padding: "14px 18px 4px" }}>Categories</div>
        {d.breakdown.map((c) =>
          sideItem(c.category, c.category, <CategoryIcon category={c.category} size={16} />, <span style={{ color: GRAY, fontVariantNumeric: "tabular-nums" }}>{usd0(c.amount)}</span>)
        )}
      </div>

      {/* content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ height: 52, display: "flex", alignItems: "center", gap: 12, padding: "0 14px", borderBottom: `0.5px solid ${MAC.rule}`, flexShrink: 0 }}>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontSize: 15, fontWeight: 700 }}>{filter === "all" ? "All Transactions" : filter === "review" ? "Review" : filter}</div>
            <div style={{ fontSize: 11, color: GRAY }}>{d.monthLabel}</div>
          </div>
          <span style={{ flex: 1 }} />
          <div style={{ display: "flex", border: `0.5px solid ${MAC.rule}`, borderRadius: 6, overflow: "hidden", boxShadow: "0 .5px 1px rgba(0,0,0,.08)" }}>
            {["Month", "Year", "All"].map((p, i) => (
              <span key={p} style={{ padding: "3px 12px", fontSize: 12, background: i === 0 ? "#E3E3E8" : "#fff", fontWeight: i === 0 ? 600 : 400 }}>{p}</span>
            ))}
          </div>
          <button style={{ width: 30, height: 26, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}><Plus size={17} color="#555" /></button>
          <div style={{ display: "flex", alignItems: "center", gap: 5, border: `0.5px solid ${MAC.rule}`, borderRadius: 7, padding: "0 7px", height: 26, width: 190, background: "#fff" }}>
            <Search size={13} color={GRAY} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" style={{ flex: 1, outline: "none", fontSize: 13, fontFamily: SF }} />
          </div>
        </div>

        {filter === "review" ? (
          <div style={{ padding: 24, overflow: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16, alignContent: "start" }}>
            {suggestions.length === 0 && <div style={{ color: GRAY }}>No Category Suggestions waiting.</div>}
            {suggestions.map((s) => (
              <div key={s.key} style={{ border: `0.5px solid ${MAC.rule}`, borderRadius: 10, padding: 14, background: "#FBFBFD" }}>
                <div style={{ fontSize: 15, fontWeight: 700 }}>{s.label}</div>
                <div style={{ color: GRAY, marginBottom: 8 }}>{s.entries.length} entries · {formatUsd(s.total)}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button style={{ background: BLUE, color: "#fff", borderRadius: 6, padding: "3px 10px" }}>Add Category</button>
                  <button style={{ background: "#fff", border: `0.5px solid ${MAC.rule}`, borderRadius: 6, padding: "3px 10px" }}>Merge…</button>
                  <button style={{ background: "#fff", border: `0.5px solid ${MAC.rule}`, borderRadius: 6, padding: "3px 10px", color: RED }}>Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* stat strip (GroupBoxes) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.6fr", gap: 10, padding: "12px 14px", borderBottom: `0.5px solid ${MAC.rule}` }}>
              {[["Spending", formatUsd(d.stats.spending)], ["Daily Average", formatUsd(d.stats.dailyAverage)], ["Projected", formatUsd(d.stats.projected)]].map(([k, v]) => (
                <div key={k} style={{ background: "#F5F5F7", borderRadius: 8, padding: "8px 12px" }}>
                  <div style={{ color: GRAY, fontSize: 11, fontWeight: 600 }}>{k}</div>
                  <div style={{ fontSize: 20, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{v}</div>
                  {k === "Spending" && delta != null && <div style={{ fontSize: 11, color: delta > 0 ? RED : GREEN }}>{delta > 0 ? "▲" : "▼"} {Math.abs(Math.round(delta * 100))}% vs last month</div>}
                </div>
              ))}
              <div style={{ background: "#F5F5F7", borderRadius: 8, padding: "6px 10px" }}>
                <PaceLine pace={d.pace} w={300} h={70} />
              </div>
            </div>
            {/* Table */}
            <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 200px 110px", padding: "0 14px", height: 28, alignItems: "center", fontSize: 12, fontWeight: 500, color: "#555", borderBottom: `0.5px solid ${MAC.rule}`, flexShrink: 0 }}>
              <span>Date ⌄</span><span>Merchant</span><span>Category</span><span style={{ textAlign: "right" }}>Amount</span>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "0 6px" }}>
              {rows.map((r, i) => {
                const sel = r.row === selectedRow;
                return (
                  <div key={r.row} onClick={() => setSelectedRow(r.row)} style={{ display: "grid", gridTemplateColumns: "110px 1fr 200px 110px", alignItems: "center", height: 26, padding: "0 8px", borderRadius: 5, cursor: "default", background: sel ? MAC.sel : i % 2 ? MAC.alt : "transparent", color: sel ? "#fff" : undefined }}>
                    <span style={{ color: sel ? "#fff" : GRAY }}>{shortDay(r.date)}</span>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 10 }}>{r.merchant}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}><CategoryIcon category={r.category} size={15} />{r.category}</span>
                    <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: sel ? "#fff" : r.type === "Income" ? "#248A3D" : undefined }}>{r.type === "Income" ? "+" : ""}{formatUsd(r.amount)}</span>
                  </div>
                );
              })}
            </div>
            <div style={{ height: 24, borderTop: `0.5px solid ${MAC.rule}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: GRAY }}>
              {rows.length} transactions · {formatUsd(rows.filter((r) => r.type === "Expense").reduce((a, r) => a + r.amount, 0))}
            </div>
          </>
        )}
      </div>

      {/* inspector */}
      <div style={{ width: 280, borderLeft: `0.5px solid ${MAC.rule}`, background: "#F7F7F9", overflow: "auto", padding: "16px 14px" }}>
        {selected ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <CategoryIcon category={selected.category} size={36} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{selected.merchant}</div>
                <div style={{ color: GRAY }}>{weekday(selected.date)}, {shortDay(selected.date)}</div>
              </div>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 14 }}>{formatUsd(selected.amount)}</div>
            {[["Motive", selected.motive], ["Type", selected.type], ["Category", selected.category], ["Row", `#${selected.row}`]].map(([k, v]) => (
              <div key={k} style={{ display: "grid", gridTemplateColumns: "72px 1fr", gap: 8, padding: "6px 0", borderTop: `0.5px solid ${MAC.rule}` }}>
                <span style={{ color: GRAY, textAlign: "right" }}>{k}</span>
                <span style={{ wordBreak: "break-word", display: "flex", alignItems: "center", gap: 4 }}>{v}{k === "Category" && <ChevronDown size={12} color={GRAY} />}</span>
              </div>
            ))}
            {selected.type === "Expense" && (
              <label style={{ display: "flex", gap: 6, alignItems: "flex-start", marginTop: 10 }}>
                <span style={{ width: 14, height: 14, borderRadius: 3, background: BLUE, display: "inline-flex", alignItems: "center", justifyContent: "center", marginTop: 1 }}><Check size={11} color="#fff" strokeWidth={3} /></span>
                <span>Use for all of {selected.merchant}’s expenses</span>
              </label>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button style={{ flex: 1, background: BLUE, color: "#fff", borderRadius: 6, height: 24 }}>Save</button>
              <button style={{ width: 32, background: "#fff", border: `0.5px solid ${MAC.rule}`, borderRadius: 6, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}><Trash2 size={13} color={RED} /></button>
            </div>
          </>
        ) : (
          <div style={{ color: GRAY, textAlign: "center", marginTop: 80 }}>No Selection</div>
        )}
      </div>
    </div>
  );
}

// ── switcher host ───────────────────────────────────────────────────────────

export function NativePrototype({
  transactions,
  categories,
  suggestions,
  fetchedAt,
}: {
  transactions: Raw[];
  categories: readonly CategoryEntry[];
  suggestions: CategorySuggestion[];
  fetchedAt: number;
}) {
  const variant = useSearchParams().get("variant") ?? "A";
  const d = useData(transactions, categories, fetchedAt);
  // Shrink the device to fit the window so the whole screen is visible.
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const [w, h] = variant === "C" ? [1180, 740] : [417, 876];
    const fit = () => setScale(Math.min(1, (window.innerWidth - 40) / w, (window.innerHeight - 100) / h));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [variant]);
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px 20px 80px", background: variant === "C" ? "linear-gradient(135deg,#6d8fb8,#b9a3c9 60%,#e7b7a8)" : "#e5e5ea" }}>
      <div style={{ zoom: scale }}>
        {variant === "A" && <VariantA d={d} suggestions={suggestions} />}
        {variant === "B" && <VariantB d={d} suggestions={suggestions} />}
        {variant === "C" && <VariantC d={d} suggestions={suggestions} />}
      </div>
      <PrototypeSwitcher variants={VARIANTS} />
    </div>
  );
}
