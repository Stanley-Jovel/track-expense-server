const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function formatUsd(amount: number): string {
  return usd.format(amount);
}

/** "2026-06" → "Jun '26" */
export function formatMonthShort(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const name = new Date(Date.UTC(year, month - 1)).toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  return `${name} '${String(year).slice(2)}`;
}

/** "2026-06" → "June 2026" */
export function formatMonthLong(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1)).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Sheet dates are UTC wall-clock, so format them in UTC. */
export function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
