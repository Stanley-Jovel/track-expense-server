import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SmokeChart } from "./smoke-chart";

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>UI stack smoke test</CardTitle>
          <CardDescription>
            shadcn/ui + Tailwind + Recharts render correctly.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SmokeChart />
        </CardContent>
      </Card>
    </main>
  );
}
