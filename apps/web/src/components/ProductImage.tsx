import { productImage } from '@/lib/photos';
import { cn } from '@/lib/utils';

export function ProductImage({ sku, name, className }: { sku: string; name: string; className?: string }) {
  return (
    <span className={cn('block shrink-0 overflow-hidden rounded-md border border-border bg-[#141416]', className)}>
      <img src={productImage(sku)} alt={name} className="size-full object-cover" loading="lazy" decoding="async" />
    </span>
  );
}
