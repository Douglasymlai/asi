import { Button } from "../../components/Button";

interface Customer {
  id: string;
  name: string;
  email: string;
  orderCount: number;
  lastOrderAt: string;
}

export default async function CustomersPage() {
  const response = await fetch("/api/customers");
  const customers: Customer[] = await response.json();

  return (
    <main>
      <h1>Customers</h1>
      <p>{customers.length} customers</p>
      <Button id="open_customer">Open Customer</Button>
    </main>
  );
}
