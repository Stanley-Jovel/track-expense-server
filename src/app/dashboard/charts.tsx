"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  MonthlyComparison,
  TimePoint,
} from "@/app/services/analytics/aggregate";
import { formatMonthShort, formatUsd } from "./format";

const AXIS_TICK = { fill: "var(--viz-axis-ink)", fontSize: 11 } as const;

const tooltipContentStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
} as const;

function compactUsd(value: number): string {
  return `$${Intl.NumberFormat("en-US", { notation: "compact" }).format(value)}`;
}

export function SpendingTrendChart({
  data,
  isMonthly,
}: {
  data: TimePoint[];
  isMonthly: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--viz-grid)" strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
          tickFormatter={(label: string) =>
            isMonthly ? formatMonthShort(label) : label
          }
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={compactUsd}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          formatter={(value) => [formatUsd(Number(value)), "Spending"]}
          labelFormatter={(label) =>
            isMonthly ? formatMonthShort(String(label)) : `Day ${String(label)}`
          }
        />
        <Area
          type="monotone"
          dataKey="amount"
          stroke="var(--viz-spending)"
          strokeWidth={2}
          fill="var(--viz-spending)"
          fillOpacity={0.1}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function IncomeVsSpendingChart({ data }: { data: MonthlyComparison[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        barGap={2}
      >
        <CartesianGrid stroke="var(--viz-grid)" strokeWidth={1} vertical={false} />
        <XAxis
          dataKey="month"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
          minTickGap={24}
          tickFormatter={formatMonthShort}
        />
        <YAxis
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={44}
          tickFormatter={compactUsd}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          formatter={(value, name) => [formatUsd(Number(value)), String(name)]}
          labelFormatter={(label) => formatMonthShort(String(label))}
        />
        <Legend
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => (
            <span style={{ color: "var(--muted-foreground)" }}>{value}</span>
          )}
        />
        <Bar
          dataKey="income"
          name="Income"
          fill="var(--viz-income)"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
        />
        <Bar
          dataKey="spending"
          name="Spending"
          fill="var(--viz-spending)"
          radius={[4, 4, 0, 0]}
          maxBarSize={24}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
