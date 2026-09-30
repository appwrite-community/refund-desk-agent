import { useNow } from '@/hooks/use-now';
import { age, ago, timestamp } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Tooltip } from './ui/tooltip';

/** "2h" or "2 hours ago", with the full timestamp on hover and focus. */
export function RelativeTime({ value, format = 'age', className }: { value: string; format?: 'age' | 'ago'; className?: string }) {
  const now = useNow(30_000);
  return (
    <Tooltip content={timestamp(value)}>
      <time dateTime={value} className={cn('whitespace-nowrap', className)}>
        {format === 'age' ? age(value, now) : ago(value, now)}
      </time>
    </Tooltip>
  );
}
