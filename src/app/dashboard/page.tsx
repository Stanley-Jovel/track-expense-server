import { Metadata } from "next";
import { Suspense } from "react";
import { getTransactions } from "@/app/services/spreadsheet/cached-transactions";
import { DashboardClient, SerializableTransaction } from "./dashboard-client";
import { PrototypeRefresh } from "./prototype-refresh/variants";

// ISR: regenerate with fresh sheet data at most every 60s (matches the
// unstable_cache TTL in cached-transactions).
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Expenses",
  description: "Expense tracking dashboard",
};

export default async function DashboardPage() {
  const transactions = await getTransactions();
  const serializable: SerializableTransaction[] = transactions.map((t) => ({
    ...t,
    date: t.date.toISOString(),
  }));
  // When this ISR page was generated — the variants show it as data age.
  const fetchedAt = Date.now();

  return (
    // useSearchParams in the client components needs a Suspense boundary.
    <Suspense>
      {/* PROTOTYPE: refresh-affordance variants, switchable via ?variant= */}
      <PrototypeRefresh fetchedAt={fetchedAt} />
      <DashboardClient transactions={serializable} />
    </Suspense>
  );
}
