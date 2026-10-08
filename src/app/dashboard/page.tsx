import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SmokeChart } from "./smoke-chart";
import { getTransactions } from "@/app/services/spreadsheet/cached-transactions";

export default async function DashboardPage() {
  const transactions = await getTransactions();
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>UI stack smoke test</CardTitle>
          <CardDescription>
            {transactions.length} transactions loaded from the sheet, latest:{" "}
            {transactions.at(-1)?.motive ?? "none"}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SmokeChart />
        </CardContent>
      </Card>
    </main>
  );
}
