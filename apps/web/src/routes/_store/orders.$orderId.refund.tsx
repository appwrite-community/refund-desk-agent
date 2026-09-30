import { createFileRoute } from '@tanstack/react-router';
import { RefundForm } from '@/features/store/RefundForm';

export const Route = createFileRoute('/_store/orders/$orderId/refund')({
  validateSearch: (search: Record<string, unknown>): { item: string } => ({
    item: typeof search.item === 'string' ? search.item : '',
  }),
  component: NewRequest,
});

function NewRequest() {
  const { orderId } = Route.useParams();
  const { item } = Route.useSearch();
  const { viewer } = Route.useRouteContext();
  return <RefundForm key={`${orderId}-${item}`} orderId={orderId} sku={item} customerId={viewer.user.$id} />;
}
