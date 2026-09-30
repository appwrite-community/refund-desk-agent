import { CircleAlert, ImagePlus, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState, type DragEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ACCEPTED_TYPES, PhotoError, preparePhoto } from '@/lib/photos';
import { cn } from '@/lib/utils';

type PhotoDropzoneProps = {
  file: File | null;
  onChange: (file: File | null) => void;
  /** Upload progress from 0 to 1 while the photo uploads. */
  progress: number | null;
  disabled?: boolean;
  invalid?: boolean;
  compact?: boolean;
  describedBy?: string;
};

const kb = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`);

/** Drag and drop or browse for one photo. Photos are resized before they are handed back. */
export function PhotoDropzone({ file, onChange, progress, disabled, invalid, compact, describedBy }: PhotoDropzoneProps) {
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  async function accept(selected: File | undefined) {
    if (!selected) return;
    setError(null);
    setPreparing(true);
    try {
      onChange(await preparePhoto(selected));
    } catch (err) {
      setError(err instanceof PhotoError ? err.message : 'That photo could not be read.');
    } finally {
      setPreparing(false);
      if (input.current) input.current.value = '';
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!disabled) void accept(event.dataTransfer.files[0]);
  }

  const picker = (
    <input
      ref={input}
      id={inputId}
      type="file"
      accept={ACCEPTED_TYPES.join(',')}
      className="sr-only"
      disabled={disabled}
      onChange={(event) => void accept(event.target.files?.[0])}
      aria-describedby={describedBy}
      tabIndex={-1}
    />
  );

  if (file && preview) {
    return (
      <div className={cn('overflow-hidden rounded-md border border-border-strong bg-raised', compact ? 'flex items-center gap-3 p-2.5' : '')}>
        {picker}
        <img
          src={preview}
          alt="Selected photo"
          className={cn('bg-black object-cover', compact ? 'size-14 rounded-sm' : 'aspect-[16/9] w-full')}
        />
        <div className={cn('flex items-center gap-3', compact ? 'min-w-0 flex-1' : 'px-3.5 py-3')}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-13 font-medium">{file.name}</p>
            {progress === null ? (
              <p className="text-xs text-muted">{kb(file.size)}, resized for upload</p>
            ) : (
              <div className="mt-1.5 flex items-center gap-2.5">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-border-strong" role="progressbar" aria-label="Upload progress" aria-valuenow={Math.round(progress * 100)}>
                  <div className="h-full rounded-full bg-foreground transition-[width] duration-200" style={{ width: `${Math.max(4, progress * 100)}%` }} />
                </div>
                <span className="w-9 text-right text-xs text-muted tabular">{Math.round(progress * 100)}%</span>
              </div>
            )}
          </div>
          {progress === null && (
            <div className="flex shrink-0 gap-1">
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => input.current?.click()}>
                <RefreshCw aria-hidden />
                Replace
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(null)}>
                <Trash2 aria-hidden />
                Remove
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {picker}
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            input.current?.click();
          }
        }}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          'flex cursor-pointer items-center justify-center gap-3 rounded-md border border-dashed border-border-strong bg-surface text-center transition-colors duration-150',
          'hover:border-[#4a4a54] hover:bg-raised aria-invalid:border-rose/60',
          compact ? 'px-4 py-3.5' : 'flex-col px-6 py-8',
          dragging && 'border-foreground/60 bg-raised',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <span className="flex size-9 items-center justify-center rounded-md border border-border-strong bg-raised text-muted">
          <ImagePlus className="size-4.5" strokeWidth={1.75} aria-hidden />
        </span>
        <span className={compact ? 'text-left' : ''}>
          <span className="block text-13 font-medium text-foreground">
            {preparing ? 'Preparing photo…' : dragging ? 'Drop to add the photo' : 'Drop a photo here, or browse'}
          </span>
          <span className="block text-xs text-muted">JPG, PNG, or WebP. Large photos are resized before upload.</span>
        </span>
      </label>
      {error && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-13 text-rose">
          <CircleAlert className="size-3.5" aria-hidden />
          {error}
        </p>
      )}
    </div>
  );
}
