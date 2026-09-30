import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { LockKeyhole } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/use-page-title';
import { signOut } from '@/lib/session';

/** A signed-in customer opened the desk. The data is protected by permissions either way. */
export function PermissionLimited({ email }: { email: string }) {
  usePageTitle('Desk');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_50%_45%_at_50%_50%,black,transparent)]"
      />
      <div className="relative w-full max-w-[420px] rounded-lg border border-border bg-surface p-8 text-center">
        <span className="relative mx-auto mb-6 flex size-12 items-center justify-center rounded-md border border-border-strong bg-raised text-foreground">
          <LogoMark />
          <span className="absolute -right-2 -bottom-2 flex size-6 items-center justify-center rounded-full border border-border-strong bg-surface text-muted">
            <LockKeyhole className="size-3" aria-hidden />
          </span>
        </span>
        <h1 className="text-xl font-semibold tracking-[-0.02em]">The desk is for Pourhaven staff</h1>
        <p className="mt-2 text-sm text-muted">
          You are signed in as <span className="font-medium text-foreground">{email}</span>. Staff accounts see refund requests from every
          customer, so this page needs a staff account.
        </p>
        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button asChild>
            <Link to="/orders">Go to your orders</Link>
          </Button>
          <Button
            variant="secondary"
            onClick={() => void signOut(queryClient).then(() => navigate({ to: '/sign-in', search: { redirect: '/desk' } }))}
          >
            Sign in as staff
          </Button>
        </div>
      </div>
    </main>
  );
}
