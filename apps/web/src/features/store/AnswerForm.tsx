import { AppwriteException } from 'appwrite';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { IntakeError, submitReply, uploadPhoto } from '@/lib/intake';
import { cn } from '@/lib/utils';
import { PhotoDropzone } from './PhotoDropzone';

const MAX_ANSWER = 2000;

/** The customer's answer to a question. Sending it starts the agent again. */
export function AnswerForm({ requestId }: { requestId: string }) {
  const [message, setMessage] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploaded = useRef<{ file: File; fileId: string } | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!message.trim()) {
      setError('Write your answer first.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      let photoId: string | null = null;
      if (photo) {
        if (uploaded.current?.file !== photo) {
          setProgress(0);
          const file = await uploadPhoto(photo, ({ progress: percent }) => setProgress(percent / 100));
          uploaded.current = { file: photo, fileId: file.$id };
        }
        photoId = uploaded.current.fileId;
      }
      await submitReply(requestId, { message: message.trim(), photoId });
      setSent(true);
    } catch (err) {
      setError(
        err instanceof IntakeError || err instanceof AppwriteException
          ? err.message
          : 'Could not reach Pourhaven. Check your connection and try again.',
      );
      setPending(false);
    } finally {
      setProgress(null);
    }
  }

  if (sent) {
    return (
      <div role="status" className="flex items-center gap-3 border-t border-border bg-background/40 px-6 py-4 text-13">
        <CircleCheck className="size-4 text-green" aria-hidden />
        <span className="font-medium">Answer sent.</span>
        <span className="text-muted">Our refund agent is looking at it now.</span>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="border-t border-border bg-background/40 px-6 py-5">
      <div className="mb-2 flex items-baseline justify-between">
        <Label htmlFor="answer">Your answer</Label>
        <span className={cn('text-xs tabular', message.length > MAX_ANSWER - 100 ? 'text-amber' : 'text-subtle')}>
          {message.length}/{MAX_ANSWER}
        </span>
      </div>
      <Textarea
        id="answer"
        rows={3}
        maxLength={MAX_ANSWER}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Type your answer"
        disabled={pending}
        aria-invalid={error ? true : undefined}
      />
      <div className="mt-3">
        <PhotoDropzone file={photo} onChange={setPhoto} progress={progress} disabled={pending} compact />
      </div>
      {error && (
        <p role="alert" className="mt-3 flex items-center gap-1.5 text-13 text-rose">
          <CircleAlert className="size-3.5" aria-hidden />
          {error}
        </p>
      )}
      <div className="mt-4 flex items-center gap-3">
        <Button type="submit" pending={pending}>
          Send answer
        </Button>
        <span className="text-xs text-muted">A photo is optional.</span>
      </div>
    </form>
  );
}
