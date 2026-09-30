import { createFileRoute } from '@tanstack/react-router';
import { MousePointerClick } from 'lucide-react';
import { EmptyState } from '@/components/States';
import { Kbd } from '@/components/ui/kbd';

export const Route = createFileRoute('/desk/$queue/')({
  component: NoSelection,
});

function NoSelection() {
  return (
    <EmptyState icon={MousePointerClick} title="Select a request" className="h-full">
      Pick a request from the list to see the agent's findings and every step it took. Use <Kbd>J</Kbd> and <Kbd>K</Kbd> to move.
    </EmptyState>
  );
}
