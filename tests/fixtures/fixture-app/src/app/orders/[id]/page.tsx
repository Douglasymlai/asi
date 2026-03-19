import { Button } from "../../../components/Button";

const ORDER_STATES = ["pending", "confirmed", "shipped", "delivered", "cancelled", "refunded"];
const ROLES = ["admin", "support", "viewer"];

async function getOrder(id: string) {
  const response = await fetch(`/api/orders/${id}`);
  return response.json();
}

export default async function OrderDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);
  const status = order.status;
  const role = order.viewerRole;

  return (
    <main
      data-page-type="detail"
      data-entity="order"
      data-purpose="View and manage a single order"
      data-entity-fields="id,status,total,customer,items,created_at"
      data-state-options={ORDER_STATES}
      data-role-options={ROLES}
    >
      <h1>Order Detail</h1>
      {["confirmed", "shipped", "delivered"].includes(status) && (
        <Button
          id="refund_order"
          variant="destructive"
          data-action-intent="refund_order"
          data-risk="high"
          data-requires-confirmation={true}
          data-side-effects="financial,state_change"
          data-reversible={false}
          data-available-status="confirmed,shipped,delivered"
          data-available-role="admin"
        >
          Refund
        </Button>
      )}
      {["pending", "confirmed"].includes(status) && (
        <Button
          id="cancel_order"
          variant="destructive"
          data-action-intent="cancel_order"
          data-risk="high"
          data-requires-confirmation={true}
          data-side-effects="financial,state_change,notification"
          data-reversible={false}
          data-available-status="pending,confirmed"
          data-available-role="admin,support"
        >
          Cancel Order
        </Button>
      )}
      {role !== "viewer" && (
        <Button
          id="edit_shipping"
          data-action-intent="edit_shipping_address"
          data-risk="low"
          data-side-effects="state_change"
          data-reversible={true}
          data-available-status="pending,confirmed"
          data-available-role="admin,support"
        >
          Edit Shipping
        </Button>
      )}
      {role === "admin" && (
        <Button
          id="archive_order"
          variant="destructive"
          data-action-intent="archive_order"
          data-risk="high"
          data-side-effects="state_change"
          data-reversible={false}
          data-available-status="delivered,refunded,cancelled"
          data-available-role="admin"
        >
          Archive Order
        </Button>
      )}
    </main>
  );
}
