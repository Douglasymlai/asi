import { Button } from "../../components/Button";

export default async function ReportsPage() {
  await fetch("/api/reports/revenue");

  return (
    <main>
      <h1>Reports</h1>
      <Button id="export_revenue_report">Export Revenue Report</Button>
    </main>
  );
}
