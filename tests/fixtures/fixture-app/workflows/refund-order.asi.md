# refund_order

> Process a refund for an order

## trigger
- refund_order

## available_when
- status: confirmed, shipped, delivered
- role: admin

## steps

1. [open_refund_modal] Click "Refund" button
2. [select_refund_amount] Enter refund amount
   - optional: [add_refund_note] Add a note for the refund reason
3. [confirm_refund] Click "Confirm Refund"

## completion
- signal: toast_success
- message_contains: "refund"
- redirects_to: "/orders/:id"
- state_change: status → refunded

## metadata
- risk: high
- sideEffects: financial, state_change
- reversible: false
