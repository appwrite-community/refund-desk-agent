import { Expand, ImageOff, X } from 'lucide-react';
import { useState } from 'react';
import { photoUrl } from '@/lib/photos';
import { cn } from '@/lib/utils';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from './ui/dialog';

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
      <DialogContent className="w-auto max-w-[min(56rem,calc(100%-2rem))] overflow-hidden p-0" showClose={false}>
        <img src={src} alt={label} className="block max-h-[78dvh] w-auto max-w-full bg-black" />
        <div className="flex items-center gap-4 border-t border-border px-5 py-3">
          <DialogTitle className="min-w-0 flex-1 truncate text-sm">{label}</DialogTitle>
          {caption && <DialogDescription className="truncate text-xs">{caption}</DialogDescription>}
          <DialogClose className="-mr-1.5 rounded-sm p-1 text-subtle transition-colors hover:bg-hover hover:text-foreground">
            <X className="size-4" aria-hidden />
            <span className="sr-only">Close</span>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}
