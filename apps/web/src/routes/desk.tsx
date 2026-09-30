import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { DeskLayout } from '@/features/desk/DeskLayout';
import { PermissionLimited } from '@/features/desk/PermissionLimited';
import { viewerQuery } from '@/lib/queries';
import { useRequestsRealtime } from '@/lib/realtime';

export const Route = createFileRoute('/desk')({
  beforeLoad: async ({ context, location }) => {
    const viewer = await context.queryClient.ensureQueryData(viewerQuery);
    if (!viewer) throw redirect({ to: '/sign-in', search: { redirect: location.href } });
    return { viewer };
  },
  component: Desk,
});

function Desk() {
  const { viewer } = Route.useRouteContext();
  // Route guards are for the experience; the staff team's table permissions protect the data.
  if (!viewer.staffRole) return <PermissionLimited email={viewer.user.email} />;
  return <StaffDesk />;
}

function StaffDesk() {
  const { viewer } = Route.useRouteContext();
  useRequestsRealtime();
  return (
    <DeskLayout viewer={viewer}>
      <Outlet />
    </DeskLayout>
  );
}
