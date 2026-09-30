import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return (
    <kbd
      className={cn(
        'inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-[4px] border border-current/25 px-1 font-sans text-[11px] leading-none font-medium opacity-80',
        className,
      )}
      {...props}
    />
  );
}
