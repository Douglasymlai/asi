import { Button } from "../../components/Button";

export default function ProductsPage() {
  return (
    <main
      data-page-type="list"
      data-entity="product"
      data-purpose="Browse products and create new listings"
      data-entity-fields="id,title,inventory,status,price"
      data-state-options="draft,active,archived"
      data-role-options="admin,merchandiser,viewer"
    >
      <h1>Products</h1>
      <Button
        id="create_product"
        data-action-intent="create_product"
        data-risk="medium"
        data-side-effects="state_change"
        data-available-role="admin,merchandiser"
      >
        Create Product
      </Button>
    </main>
  );
}
