# edit_shipping_address

> Update the shipping address for an eligible order

## trigger
- edit_shipping_address

## available_when
- status: pending, confirmed
- role: admin, support

## steps

1. [open_shipping_editor] Click "Edit Shipping" button
2. [update_shipping_fields] Enter the new shipping address
3. [save_shipping_changes] Click "Save Shipping"

## completion
- signal: toast_success
- message_contains: "shipping"
- redirects_to: "/orders/:id"
- state_change: shipping_address → updated

## metadata
- risk: low
- sideEffects: state_change
- reversible: true
