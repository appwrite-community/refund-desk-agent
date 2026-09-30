import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/desk/')({
  beforeLoad: () => {
    throw redirect({ to: '/desk/$queue', params: { queue: 'needs-approval' } });
  },
});
