import { createFileRoute } from '@tanstack/react-router';
import { RequestPage } from '@/features/store/RequestPage';

export const Route = createFileRoute('/_store/requests/$requestId')({
  component: Request,
});

function Request() {
  const { requestId } = Route.useParams();
  return <RequestPage key={requestId} requestId={requestId} />;
}
