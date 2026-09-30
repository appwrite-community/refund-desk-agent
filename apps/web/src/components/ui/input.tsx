import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-9 w-full rounded-sm border border-input bg-surface px-3 text-sm text-foreground transition-[border-color,box-shadow] duration-150 outline-none placeholder:text-subtle',
        'hover:border-[#3c3c44] focus-visible:border-iris focus-visible:ring-3 focus-visible:ring-iris/20 aria-invalid:border-rose/60',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
