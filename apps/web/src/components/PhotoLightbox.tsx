import { Expand, ImageOff } from 'lucide-react';
import { useState } from 'react';
import { photoUrl } from '@/lib/photos';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog';

type PhotoLightboxProps = {
  fileId: string;
  token: string;
  /** Alt text and dialog title, for example "Photo from Priya Raman". */
  label: string;
  caption?: string;
  className?: string;
};

/** A photo thumbnail that opens full size in a dialog. */
export function PhotoLightbox({ fileId, token, label, caption, className }: PhotoLightboxProps) {
  const [failed, setFailed] = useState(false);
  const src = photoUrl(fileId, token);

  if (failed) {
    return (
      <div className={cn('flex flex-col items-center justify-center gap-1.5 rounded-md border border-border bg-raised text-xs text-subtle', className)}>
        <ImageOff className="size-4" aria-hidden />
        Photo unavailable
      </div>
    );
  }

  return (
    <Dialog>
      <DialogTrigger
        className={cn(
          'group relative block overflow-hidden rounded-md border border-border bg-raised transition-colors hover:border-border-strong',
          className,
        )}
      >
        <img src={src} alt={label} className="size-full object-cover" onError={() => setFailed(true)} decoding="async" />
        <span className="absolute right-1.5 bottom-1.5 flex size-6 items-center justify-center rounded-sm bg-black/60 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Expand className="size-3.5" aria-hidden />
        </span>
        <span className="sr-only">Open {label}</span>
      </DialogTrigger>
      <DialogContent className="max-w-4xl overflow-hidden p-0">
        <img src={src} alt={label} className="max-h-[78dvh] w-full bg-black object-contain" />
        <div className="flex items-center justify-between gap-4 border-t border-border px-5 py-3.5 pr-14">
          <DialogTitle className="text-sm">{label}</DialogTitle>
          {caption && <DialogDescription className="truncate text-xs">{caption}</DialogDescription>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
