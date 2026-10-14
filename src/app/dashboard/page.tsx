import { Metadata } from "next";
import { Suspense } from "react";
import { getCategories, getTransactions } from "@/app/services/spreadsheet/cached-transactions";
import { categoryNames, notSpendingOf } from "@/app/services/llm/types";
import { DashboardClient, SerializableTransaction } from "./dashboard-client";
import { RefreshBar } from "./refresh-bar";
import { listSuggestions } from "./suggestions";

// ISR: regenerate with fresh sheet data at most every 60s (matches the
// unstable_cache TTL in cached-transactions).
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Expenses",
  description: "Expense tracking dashboard",
};

export default async function DashboardPage() {
  const [transactions, categories, suggestions] = await Promise.all([
    getTransactions(),
    getCategories(),
    listSuggestions(),
  ]);
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
        {/* The page is an edge: the Categories sheet decides the Category
            list and which Categories don't count as Spending. */}
        <DashboardClient
          transactions={serializable}
          fetchedAt={fetchedAt}
          categoryList={categoryNames(categories)}
          notSpending={notSpendingOf(categories)}
          suggestions={suggestions}
        />
      </Suspense>
    </div>
  );
}
