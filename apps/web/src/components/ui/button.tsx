import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-sm font-medium transition-[background-color,border-color,color,box-shadow] duration-150 ease-out outline-none select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-white active:bg-[#d6d6db]',
        secondary: 'border border-border-strong bg-raised text-foreground hover:border-[#3c3c44] hover:bg-hover',
        outline: 'border border-border-strong bg-transparent text-foreground hover:bg-hover',
        ghost: 'text-muted hover:bg-hover hover:text-foreground',
        link: 'h-auto px-0 text-foreground underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-13 [&_svg]:size-3.5',
        default: 'h-9 px-3.5 text-sm [&_svg]:size-4',
        lg: 'h-10 px-4 text-sm [&_svg]:size-4',
        icon: 'size-8 [&_svg]:size-4',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /** Shows a spinner and disables the button. The label stays the same. */
    pending?: boolean;
  };

export function Button({ className, variant, size, asChild = false, pending = false, disabled, children, ...props }: ButtonProps) {
  if (asChild) {
    return <Slot.Root className={cn(buttonVariants({ variant, size, className }))} {...props}>{children}</Slot.Root>;
  }
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      {...props}
    >
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
