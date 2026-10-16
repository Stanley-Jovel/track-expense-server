// PROTOTYPE — throwaway. "What would this app look like as a native Swift app?"
// Three variants, switchable via ?variant=A|B|C, on real sheet data:
//   A  iPhone, SwiftUI TabView + inset-grouped Lists (stock Apple look)
//   B  iPhone, Wallet / Apple Card style (one hero card, activity bars)
//   C  macOS, NavigationSplitView + Table + inspector
// Xcode isn't installed on this machine, so these are HTML imitations of
// SwiftUI's stock components, not compiled Swift. Read-only: no mutations.

import { Suspense } from "react";
import { getCategories, getTransactions } from "@/app/services/spreadsheet/cached-transactions";
import { listSuggestions } from "@/app/dashboard/suggestions";
import { NativePrototype } from "./native-prototype";

export const dynamic = "force-dynamic";

export default async function NativePrototypePage() {
  const [transactions, categories, suggestions] = await Promise.all([
    getTransactions(),
    getCategories(),
    listSuggestions(),
  ]);
  return (
    <Suspense>
      <NativePrototype
        transactions={transactions.map((t) => ({ ...t, date: t.date.toISOString() }))}
        categories={categories}
        suggestions={suggestions}
        fetchedAt={Date.now()}
      />
    </Suspense>
  );
}
