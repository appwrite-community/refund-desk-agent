import { createFileRoute } from '@tanstack/react-router';
import { OrdersPage } from '@/features/store/OrdersPage';

export const Route = createFileRoute('/_store/orders')({
  component: Orders,
});

function Orders() {
  const { viewer } = Route.useRouteContext();
  return <OrdersPage customerId={viewer.user.$id} />;
}
