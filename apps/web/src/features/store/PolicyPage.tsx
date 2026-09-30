import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'lucide-react';
import { EmptyState, ErrorState } from '@/components/States';
import { Skeleton } from '@/components/ui/skeleton';
import { usePageTitle } from '@/hooks/use-page-title';
import { policiesQuery } from '@/lib/queries';
import { PageHeader } from './PageHeader';

/** The refund policy. The same rows are what the refund agent reads with its read_policy tool. */
export function PolicyPage() {
  usePageTitle('Refund policy');
  const policies = useQuery(policiesQuery);

  return (
    <>
      <PageHeader title="Refund policy">How refunds work at Pourhaven, and what our refund agent checks.</PageHeader>
      {policies.isError ? (
        <ErrorState title="We could not load the refund policy." onRetry={() => void policies.refetch()} />
      ) : policies.isPending ? (
        <div className="grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)]">
          <div className="hidden space-y-3 lg:block">
            {Array.from({ length: 7 }, (_, index) => (
              <Skeleton key={index} className="h-4 w-36" />
            ))}
          </div>
          <div className="max-w-2xl space-y-10">
            {Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="space-y-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        </div>
      ) : policies.data.length === 0 ? (
        <EmptyState icon={BookOpen} title="No policy published yet" />
      ) : (
        <div className="grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)]">
          <nav aria-label="Sections" className="hidden lg:block">
            <ol className="sticky top-24 space-y-1 border-l border-border">
              {policies.data.map((policy) => (
                <li key={policy.$id}>
                  <a
                    href={`#${policy.$id}`}
                    className="-ml-px block border-l border-transparent py-1 pl-4 text-13 text-muted transition-colors hover:border-foreground/50 hover:text-foreground"
                  >
                    {policy.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="max-w-2xl divide-y divide-border">
            {policies.data.map((policy) => (
              <section key={policy.$id} id={policy.$id} className="scroll-mt-24 py-7 first:pt-0">
                <h2 className="text-base font-semibold tracking-[-0.01em]">{policy.title}</h2>
                <p className="mt-2 text-sm leading-6 whitespace-pre-line text-muted">{policy.body}</p>
              </section>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
