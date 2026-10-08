"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

const data = [
  { month: "Jan", total: 400 },
  { month: "Feb", total: 320 },
  { month: "Mar", total: 510 },
];

export function SmokeChart() {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <XAxis dataKey="month" />
        <YAxis />
        <Bar dataKey="total" fill="var(--color-primary)" radius={4} />
      </BarChart>
    </ResponsiveContainer>
  );
}
