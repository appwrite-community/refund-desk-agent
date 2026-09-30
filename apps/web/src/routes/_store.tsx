import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { StoreShell } from '@/features/store/StoreShell';
import { viewerQuery } from '@/lib/queries';
import { useRequestsRealtime } from '@/lib/realtime';

export const Route = createFileRoute('/_store')({
  beforeLoad: async ({ context, location }) => {
    const viewer = await context.queryClient.ensureQueryData(viewerQuery);
    if (!viewer) throw redirect({ to: '/sign-in', search: { redirect: location.href } });
    if (viewer.staffRole) throw redirect({ to: '/desk' });
    return { viewer };
  },
  component: StoreLayout,
});

function StoreLayout() {
  // Request statuses on every customer page update live.
  useRequestsRealtime();
  return (
    <StoreShell>
      <Outlet />
    </StoreShell>
  );
}
