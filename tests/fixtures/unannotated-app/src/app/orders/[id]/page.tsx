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
    <main>
      <h1>Order Detail</h1>
      <p>Status: {status}</p>
      {["confirmed", "shipped", "delivered"].includes(status) && (
        <Button id="refund_order" variant="destructive" onClick={handleRefund}>
          Refund
        </Button>
      )}
      {["pending", "confirmed"].includes(status) && (
        <Button id="cancel_order" variant="destructive" onClick={handleCancel}>
          Cancel Order
        </Button>
      )}
      {role !== "viewer" && (
        <Button id="edit_shipping" onClick={handleEditShipping}>
          Edit Shipping
        </Button>
      )}
      {role === "admin" && (
        <Button id="archive_order" variant="destructive" onClick={handleArchive}>
          Archive Order
        </Button>
      )}
    </main>
  );
}

function handleRefund() {}
function handleCancel() {}
function handleEditShipping() {}
function handleArchive() {}
