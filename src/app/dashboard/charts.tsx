"use client";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PacePoint, TimePoint } from "@/app/services/analytics/aggregate";
import { formatMonthShort, formatUsd } from "./format";

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const AXIS_TICK = {
  fill: "var(--ledger-faint)",
  fontSize: 11,
  fontFamily: "var(--font-ledger)",
} as const;

const TOOLTIP_STYLE = {
  background: "var(--ledger-card)",
  border: "1px solid var(--ledger-rule)",
  borderRadius: 2,
  fontSize: 12,
  fontFamily: "var(--font-ledger)",
  color: "var(--ledger-ink)",
} as const;

/**
 * Cumulative Spending through the window (solid ink) against the previous
 * window's cumulative ghost (dotted). Day units for a month, months for a year.
 */
export function PaceChart({
  data,
  yearly,
}: {
  data: PacePoint[];
  yearly: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <XAxis
          dataKey="unit"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--ledger-rule)" }}
          interval={yearly ? 0 : "preserveStartEnd"}
          minTickGap={yearly ? 4 : 32}
          tickFormatter={(u: number) =>
            yearly ? MONTH_ABBR[u - 1].slice(0, 1) : String(u)
          }
        />
        <YAxis hide />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value, name) => [
            formatUsd(Number(value)),
            name === "current"
              ? `This ${yearly ? "year" : "month"}`
              : `Last ${yearly ? "year" : "month"}`,
          ]}
          labelFormatter={(u) =>
            yearly ? MONTH_ABBR[Number(u) - 1] : `Day ${u}`
          }
        />
        <Line
          type="monotone"
          dataKey="previous"
          stroke="var(--ledger-faint)"
          strokeWidth={1}
          strokeDasharray="2 4"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="current"
          stroke="var(--ledger-ink)"
          strokeWidth={1.75}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** All-time view: Spending per month as a single thin ink line. */
export function MonthlyTrendChart({ data }: { data: TimePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "var(--ledger-rule)" }}
          interval="preserveStartEnd"
          minTickGap={28}
          tickFormatter={formatMonthShort}
        />
        <YAxis hide />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [formatUsd(Number(value)), "Spending"]}
          labelFormatter={(label) => formatMonthShort(String(label))}
        />
        <Line
          type="monotone"
          dataKey="amount"
          stroke="var(--ledger-ink)"
          strokeWidth={1.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
