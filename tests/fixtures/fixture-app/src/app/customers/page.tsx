import { Button } from "../../components/Button";

export default function CustomersPage() {
  return (
    <main
      data-page-type="list"
      data-entity="customer"
      data-purpose="Browse and manage customers"
      data-entity-fields="id,name,email,orderCount,lastOrderAt"
    >
      <h1>Customers</h1>
      <Button id="open_customer" data-action-intent="open_customer" data-risk="low">
        Open Customer
      </Button>
    </main>
  );
}
