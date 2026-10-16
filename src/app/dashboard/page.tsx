import { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { getCategories, getTransactions } from "@/app/services/spreadsheet/cached-transactions";
import { DashboardClient, SerializableTransaction } from "./dashboard-client";
import { listSuggestions } from "./suggestions";

// ISR: regenerate with fresh sheet data at most every 60s (matches the
// unstable_cache TTL in cached-transactions).
export const revalidate = 60;

export const metadata: Metadata = {
  title: "Expenses",
  description: "Expense tracking dashboard",
  appleWebApp: { capable: true, title: "Expenses", statusBarStyle: "default" },
};

// Edge to edge on the iPhone; Konsta pads for the notch and home indicator.
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#efeff4" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
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
  // When this ISR page was generated — the navbar shows it as data age.
  const fetchedAt = Date.now();

  return (
    // iOS grey gutters around the phone-width column on wide screens.
    <div className="min-h-dvh bg-[#e5e5ea] dark:bg-[#0b0b0c]">
      {/* useSearchParams in the client component needs a Suspense boundary. */}
      <Suspense>
      {/* The page is an edge: the Categories sheet decides the Category
          list and which Categories don't count as Spending. */}
      <DashboardClient
        transactions={serializable}
        fetchedAt={fetchedAt}
        categories={categories}
        suggestions={suggestions}
      />
      </Suspense>
    </div>
  );
}
