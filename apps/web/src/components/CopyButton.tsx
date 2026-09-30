import { Check, Copy } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip } from './ui/tooltip';

/** Copies a value and confirms with a check mark. */
export function CopyButton({ value, label, className, children }: { value: string; label: string; className?: string; children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Tooltip content={copied ? 'Copied' : label}>
      <button
        type="button"
        onClick={() => void navigator.clipboard.writeText(value).then(() => setCopied(true))}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-[5px] text-subtle transition-colors hover:text-foreground',
          className,
        )}
        aria-label={label}
      >
        {children}
        {copied ? <Check className="size-3.5 text-green" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      </button>
    </Tooltip>
  );
}
