import { createFileRoute } from '@tanstack/react-router';
import { RequestDetail } from '@/features/desk/RequestDetail';

export const Route = createFileRoute('/desk/$queue/$requestId')({
  component: Detail,
});

function Detail() {
  const { queue, requestId } = Route.useParams();
  const { viewer } = Route.useRouteContext();
  return <RequestDetail requestId={requestId} queue={queue} viewer={viewer} />;
}
