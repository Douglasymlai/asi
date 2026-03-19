import { Button } from "../../components/Button";

export default async function ReportsPage() {
  await fetch("/api/reports/revenue");

  return (
    <main data-page-type="dashboard" data-purpose="Review operational reports and revenue performance">
      <h1>Reports</h1>
      <Button id="export_revenue_report" data-action-intent="export_revenue_report" data-risk="low" data-side-effects="export">
        Export Revenue Report
      </Button>
    </main>
  );
}
