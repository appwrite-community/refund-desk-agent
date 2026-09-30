import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { Compass } from 'lucide-react';
import { EmptyState } from '@/components/States';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
  notFoundComponent: NotFound,
});

function Root() {
  return (
    <TooltipProvider delayDuration={300}>
      <Outlet />
      <Toaster />
    </TooltipProvider>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-svh items-center justify-center">
      <EmptyState
        icon={Compass}
        title="This page does not exist"
        action={
          <Button asChild variant="secondary" size="sm">
            <Link to="/">Go home</Link>
          </Button>
        }
      >
        Check the address, or head back to where you started.
      </EmptyState>
    </div>
  );
}
