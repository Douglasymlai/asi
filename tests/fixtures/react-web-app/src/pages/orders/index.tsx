import { Button } from "../../components/ui/button";

export default function OrdersPage() {
  return (
    <section data-entity="order">
      <h1>Browse and triage orders</h1>
      <Button id="filter_orders">Filter Orders</Button>
      <Button id="export_orders" variant="secondary">Export Orders</Button>
    </section>
  );
}
