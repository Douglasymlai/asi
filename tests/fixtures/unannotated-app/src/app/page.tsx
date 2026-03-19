import { Button } from "../components/Button";

export default function DashboardPage() {
  return (
    <main>
      <h1>Operations Dashboard</h1>
      <section>
        <h2>Revenue</h2>
        <p>$124,500 this month</p>
      </section>
      <section>
        <h2>Pending Actions</h2>
        <Button id="review_refunds" onClick={handleReviewRefunds}>
          Review Refund Queue
        </Button>
      </section>
    </main>
  );
}

function handleReviewRefunds() {}
