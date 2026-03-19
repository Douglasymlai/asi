import { Button } from "../../components/Button";

interface Order {
  id: string;
  status: string;
  total: number;
  customer: string;
  createdAt: string;
}

export default async function OrdersPage() {
  const response = await fetch("/api/orders");
  const orders: Order[] = await response.json();

  return (
    <main>
      <h1>Orders</h1>
      <p>{orders.length} orders loaded.</p>
      <Button id="filter_orders">Filter Orders</Button>
      <Button id="export_orders">Export Orders</Button>
    </main>
  );
}
