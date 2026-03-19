# create_product

> Create a new product listing

## trigger
- create_product

## available_when
- role: admin, merchandiser

## steps

1. [open_product_form] Click "Create Product" button
2. [fill_product_fields] Enter product details
3. [submit_product] Click "Save Product"

## completion
- signal: toast_success
- message_contains: "product"
- redirects_to: "/products"
- state_change: status → active

## metadata
- risk: medium
- sideEffects: state_change
- reversible: true
