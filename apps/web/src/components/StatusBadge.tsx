import { STATUS } from '@/lib/status';
import type { RequestStatus } from '@/lib/types';
import { Chip } from './Chip';

export function StatusBadge({
  status,
  audience = 'staff',
  size,
}: {
  status: RequestStatus;
  audience?: 'staff' | 'customer';
  size?: 'sm' | 'md';
}) {
  const meta = STATUS[status];
  return (
    <Chip tone={meta.tone} dot pulse={status === 'working'} size={size}>
      {audience === 'staff' ? meta.label : meta.customerLabel}
    </Chip>
  );
}
