import { Metadata } from "next";
import { getTransactions } from "@/app/services/spreadsheet/cached-transactions";
import { DashboardClient, SerializableTransaction } from "./dashboard-client";

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

  return <DashboardClient transactions={serializable} />;
}
