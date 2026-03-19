import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";

export default function OrderDetailPage() {
  const status = "confirmed";
  const role = "admin";

  return (
    <section data-entity="order" data-entity-fields="id,status,total,customer">
      <h1>Order detail workspace</h1>
      {["confirmed", "shipped", "delivered"].includes(status) && role === "admin" && (
        <Button id="refund_order" variant="destructive">Refund</Button>
      )}
      {["pending", "confirmed"].includes(status) && (
        <Button id="edit_shipping">Edit Shipping</Button>
      )}
      <Dialog />
    </section>
  );
}
