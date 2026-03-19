# cancel_order

> Cancel an order before fulfillment

## trigger
- cancel_order

## available_when
- status: pending, confirmed
- role: admin, support

## steps

1. [open_cancel_modal] Click "Cancel Order" button
2. [confirm_cancel] Click "Confirm Cancel"

## completion
- signal: toast_success
- message_contains: "cancel"
- redirects_to: "/orders/:id"
- state_change: status → cancelled

## metadata
- risk: high
- sideEffects: financial, state_change, notification
- reversible: false
