import { Button } from "../../components/Button";

export default async function OrdersPage() {
  const response = await fetch("/api/orders");
  const orders = await response.json();

  return (
    <main
      data-page-type="list"
      data-entity="order"
      data-purpose="Browse and search orders"
      data-entity-fields="id,status,total,customer,createdAt"
      data-state-options="pending,confirmed,shipped,delivered,cancelled,refunded"
      data-role-options="admin,support,viewer"
    >
      <h1>Orders</h1>
      <p>{orders.length} orders loaded.</p>
      <Button id="filter_orders" data-action-intent="filter_orders" data-risk="low">
        Filter Orders
      </Button>
      <Button id="export_orders" data-action-intent="export_orders" data-risk="medium" data-side-effects="export">
        Export Orders
      </Button>
    </main>
  );
}
