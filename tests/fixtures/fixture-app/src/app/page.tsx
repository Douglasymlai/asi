import { Button } from "../components/Button";

export default function DashboardPage() {
  return (
    <main data-page-type="dashboard" data-purpose="Monitor fulfillment, revenue, and support queues">
      <h1>Operations Dashboard</h1>
      <section>
        <Button id="review_refunds" data-action-intent="review_refunds" data-risk="low">
          Review Refund Queue
        </Button>
      </section>
    </main>
  );
}
