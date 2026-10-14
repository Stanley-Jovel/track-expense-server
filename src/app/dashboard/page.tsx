import { Metadata } from "next";
import { Suspense } from "react";
import { getTransactions } from "@/app/services/spreadsheet/cached-transactions";
import { BUILT_IN_NOT_SPENDING, EXPENSE_CATEGORIES } from "@/app/services/llm/types";
import { DashboardClient, SerializableTransaction } from "./dashboard-client";
import { RefreshBar } from "./refresh-bar";

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
  // When this ISR page was generated — RefreshBar shows it as data age.
  const fetchedAt = Date.now();

  return (
    // The Ledger identity: paper ground + serif type for the whole page.
    <div
      className="min-h-screen"
      style={{
        background: "var(--ledger-paper)",
        color: "var(--ledger-ink)",
        fontFamily: "var(--font-ledger)",
      }}
    >
      <RefreshBar fetchedAt={fetchedAt} />
      {/* useSearchParams in the client component needs a Suspense boundary. */}
      <Suspense>
        {/* The page is an edge: it decides the Category list and which
            Categories don't count as Spending. For now, the built-in ones. */}
        <DashboardClient
          transactions={serializable}
          fetchedAt={fetchedAt}
          categoryList={EXPENSE_CATEGORIES}
          notSpending={BUILT_IN_NOT_SPENDING}
        />
      </Suspense>
    </div>
  );
}
