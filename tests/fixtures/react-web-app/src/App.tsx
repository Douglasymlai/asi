import DashboardPage from "./pages/index";
import OrdersPage from "./pages/orders/index";
import OrderDetailPage from "./pages/orders/[id]";
import CustomersPage from "./pages/customers/index";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/orders" element={<OrdersPage />} />
      <Route path="/orders/:id" element={<OrderDetailPage />} />
      <Route path="/customers" element={<CustomersPage />} />
    </Routes>
  );
}
