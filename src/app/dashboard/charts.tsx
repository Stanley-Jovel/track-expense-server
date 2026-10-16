"use client";

import {
  Area,
  ComposedChart,
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

// Swift Charts look: system blue for this period, grey dashes for the last.
// SVG presentation attributes can't read CSS variables, so literal colours.
const BLUE = "#007AFF";
const GHOST = "#AEAEB2";
const AXIS_TICK = { fill: "#8E8E93", fontSize: 11 } as const;
const GRID = "rgba(142,142,147,.25)";

const TOOLTIP_STYLE = {
  background: "rgba(255,255,255,.92)",
  border: "none",
  borderRadius: 12,
  boxShadow: "0 4px 20px rgba(0,0,0,.12)",
  fontSize: 12,
  color: "#000",
} as const;

/**
 * Cumulative Spending through the window (blue line over a faint fill)
 * against the previous window's cumulative ghost (grey dashes). Day units for a month, months for a year.
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
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <XAxis
          dataKey="unit"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: GRID }}
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
          stroke={GHOST}
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="current"
          stroke={BLUE}
          strokeWidth={2.5}
          fill={BLUE}
          fillOpacity={0.12}
          dot={false}
          activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

/** All-time view: Spending per month as a single blue line. */
export function MonthlyTrendChart({ data }: { data: TimePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
        <XAxis
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: GRID }}
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
          stroke={BLUE}
          strokeWidth={2.5}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
