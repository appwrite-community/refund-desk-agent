import { createFileRoute, redirect } from '@tanstack/react-router';
import { viewerQuery } from '@/lib/queries';

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const viewer = await context.queryClient.ensureQueryData(viewerQuery);
    if (!viewer) throw redirect({ to: '/sign-in' });
    throw redirect({ to: viewer.staffRole ? '/desk' : '/orders' });
  },
});
