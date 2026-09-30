import { Switch as SwitchPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-5 w-8.5 shrink-0 cursor-pointer items-center rounded-full border border-transparent transition-colors duration-150 outline-none disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-foreground data-[state=unchecked]:bg-border-strong',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="pointer-events-none block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform duration-150 data-[state=checked]:translate-x-[15px] data-[state=unchecked]:translate-x-px data-[state=unchecked]:bg-foreground" />
    </SwitchPrimitive.Root>
  );
}
