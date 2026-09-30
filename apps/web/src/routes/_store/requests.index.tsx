import { createFileRoute } from '@tanstack/react-router';
import { RequestsPage } from '@/features/store/RequestsPage';

export const Route = createFileRoute('/_store/requests/')({
  component: Requests,
});

function Requests() {
  const { viewer } = Route.useRouteContext();
  return <RequestsPage customerId={viewer.user.$id} />;
}
