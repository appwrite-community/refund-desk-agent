import { createFileRoute } from '@tanstack/react-router';
import { PolicyPage } from '@/features/store/PolicyPage';
import { StoreShell } from '@/features/store/StoreShell';
import { viewerQuery } from '@/lib/queries';

// Public: the refund policy is readable without signing in.
export const Route = createFileRoute('/policy')({
  beforeLoad: async ({ context }) => {
    await context.queryClient.ensureQueryData(viewerQuery);
  },
  component: Policy,
});

function Policy() {
  return (
    <StoreShell>
      <PolicyPage />
    </StoreShell>
  );
}
