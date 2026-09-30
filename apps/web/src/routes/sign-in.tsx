import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { AppwriteException } from 'appwrite';
import { CircleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { LogoMark } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePageTitle } from '@/hooks/use-page-title';
import { viewerQuery } from '@/lib/queries';
import { homeFor, signIn } from '@/lib/session';

type SignInSearch = { redirect?: string };

export const Route = createFileRoute('/sign-in')({
  validateSearch: (search: Record<string, unknown>): SignInSearch => ({
    redirect: typeof search.redirect === 'string' && search.redirect.startsWith('/') ? search.redirect : undefined,
  }),
  beforeLoad: async ({ context }) => {
    const viewer = await context.queryClient.ensureQueryData(viewerQuery);
    if (viewer) throw redirect({ to: homeFor(Boolean(viewer.staffRole)) });
  },
  component: SignIn,
});

function signInError(err: unknown) {
  if (err instanceof AppwriteException) {
    if (err.type === 'user_invalid_credentials' || err.code === 401) return 'That email and password do not match.';
    if (err.code === 429) return 'Too many attempts. Wait a minute, then try again.';
    return err.message;
  }
  return 'Could not reach Pourhaven. Check your connection and try again.';
}

function SignIn() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  usePageTitle('Sign in');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const viewer = await signIn(queryClient, String(form.get('email')), String(form.get('password')));
      const home = homeFor(Boolean(viewer?.staffRole));
      await navigate({ to: search.redirect?.startsWith(home) ? search.redirect : home, replace: true });
    } catch (err) {
      setError(signInError(err));
      setPending(false);
    }
  }

  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-dots [mask-image:radial-gradient(ellipse_60%_55%_at_50%_45%,black,transparent)]"
      />
      <div className="relative w-full max-w-[380px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="mb-5 flex size-11 items-center justify-center rounded-md border border-border-strong bg-raised text-foreground">
            <LogoMark />
          </span>
          <h1 className="text-xl font-semibold tracking-[-0.02em]">Sign in to Pourhaven</h1>
          <p className="mt-1.5 text-13 text-muted">Brewing gear, tested at the bench.</p>
        </div>

        <form onSubmit={onSubmit} className="rounded-lg border border-border bg-surface p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                required
                aria-invalid={error ? true : undefined}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                aria-invalid={error ? true : undefined}
              />
            </div>
          </div>
          {error && (
            <p role="alert" className="mt-4 flex items-start gap-2 text-13 text-rose">
              <CircleAlert className="mt-px size-4 shrink-0" aria-hidden />
              {error}
            </p>
          )}
          <Button type="submit" className="mt-6 w-full" pending={pending}>
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-subtle">
          Questions about refunds?{' '}
          <Link to="/policy" className="text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline">
            Read the refund policy
          </Link>
        </p>
      </div>
    </main>
  );
}
