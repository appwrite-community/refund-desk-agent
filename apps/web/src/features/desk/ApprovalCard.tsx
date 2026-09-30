import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AppwriteException } from 'appwrite';
import { ChevronDown, CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { useState, type KeyboardEvent } from 'react';
import { toast } from 'sonner';
import { AgentAvatar } from '@/components/Avatars';
import { Chip } from '@/components/Chip';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useNow } from '@/hooks/use-now';
import { decide, type DecisionInput } from '@/lib/desk';
import { money, toMs, wait } from '@/lib/format';
import type { Viewer } from '@/lib/queries';
import { recommendationLabel, recommendationTone } from '@/lib/status';
import type { Approval, Decision, RefundRequest } from '@/lib/types';
import { cn } from '@/lib/utils';

type ApprovalCardProps = { approval: Approval; request: RefundRequest; viewer: Viewer };

/** The agent's recommendation and the three decisions staff can make. */
export function ApprovalCard({ approval, request, viewer }: ApprovalCardProps) {
  const queryClient = useQueryClient();
  const now = useNow(1000);
  const [requireReturn, setRequireReturn] = useState(approval.requireReturn);
  const [confirming, setConfirming] = useState(false);
  const [dialog, setDialog] = useState<'ask' | 'decline' | null>(null);
  const [expanded, setExpanded] = useState(false);

  const mutation = useMutation({
    mutationFn: (input: DecisionInput) => decide(approval, viewer, input),
    onSuccess: (row) => {
      queryClient.setQueryData<Approval[]>(['approvals', request.$id], (rows) => rows?.map((item) => (item.$id === row.$id ? row : item)));
      setDialog(null);
      setConfirming(false);
    },
    onError: (err) => {
      toast.error('The decision was not saved', {
        description: err instanceof AppwriteException ? err.message : 'Check your connection and try again.',
      });
    },
  });

  const submit = (decision: Decision, staffNote: string | null = null) => mutation.mutate({ decision, requireReturn, staffNote });
  const amount = Math.min(approval.amountCents, request.amountCents);
  const recommended: Decision =
    approval.recommendation === 'decline' ? 'decline' : approval.recommendation === 'ask_customer' ? 'ask_customer' : 'approve';

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.target !== event.currentTarget || mutation.isPending || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'a') setConfirming(true);
    else if (event.key === 'q') setDialog('ask');
    else if (event.key === 'd') setDialog('decline');
    else return;
    event.preventDefault();
  }

  return (
    <section
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="Approval"
      className="rounded-lg border border-amber/25 bg-surface outline-offset-2 focus-visible:outline-2"
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-5 py-3.5">
        <AgentAvatar size="sm" />
        <p className="text-13 font-medium">Refund agent recommends</p>
        <Chip tone={recommendationTone(approval.recommendation)} size="md">
          {recommendationLabel(approval.recommendation, approval.amountCents)}
        </Chip>
        <p className="ml-auto flex items-center gap-1.5 text-xs text-muted tabular" aria-live="off">
          <span className="size-1.5 rounded-full bg-amber" aria-hidden />
          Waiting {wait(now - toMs(approval.$createdAt))}
        </p>
      </header>

      <div className="space-y-4 px-5 py-4">
        {(approval.findings.length > 0 || approval.concerns.length > 0) && (
          <ul className="space-y-2" aria-label="Findings">
            {approval.findings.map((finding) => (
              <li key={`f-${finding}`} className="flex gap-2.5 text-13">
                <CircleCheck className="mt-px size-4 shrink-0 text-green" strokeWidth={1.75} aria-label="Checks out" />
                <span>{finding}</span>
              </li>
            ))}
            {approval.concerns.map((concern) => (
              <li key={`c-${concern}`} className="flex gap-2.5 text-13">
                <TriangleAlert className="mt-px size-4 shrink-0 text-amber" strokeWidth={1.75} aria-label="Needs a person" />
                <span>{concern}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="rounded-md bg-background/60 px-3.5 py-3">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex w-full items-center gap-1.5 rounded-[4px] text-xs font-medium text-subtle transition-colors hover:text-foreground"
            aria-expanded={expanded}
          >
            Why
            <ChevronDown className={cn('size-3.5 transition-transform duration-150', expanded && 'rotate-180')} aria-hidden />
          </button>
          <p className={cn('mt-1.5 text-13 whitespace-pre-line text-muted', !expanded && 'line-clamp-3')}>{approval.reasoning}</p>
        </div>
      </div>

      <footer className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Switch id={`return-${approval.$id}`} checked={requireReturn} onCheckedChange={setRequireReturn} disabled={mutation.isPending} />
          <Label htmlFor={`return-${approval.$id}`} className="text-13 font-normal text-muted">
            Require return first
          </Label>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Popover open={confirming} onOpenChange={setConfirming}>
            <PopoverAnchor asChild>
              <Button
                size="sm"
                variant={recommended === 'approve' ? 'default' : 'secondary'}
                pending={mutation.isPending && mutation.variables?.decision === 'approve'}
                disabled={mutation.isPending}
                onClick={() => submit('approve')}
              >
                Approve refund
                <Kbd>A</Kbd>
              </Button>
            </PopoverAnchor>
            <PopoverContent side="top" align="end" className="w-64">
              <p className="text-13 font-medium">
                {requireReturn ? `Send a return code for ${money(amount)}?` : `Refund ${money(amount)} now?`}
              </p>
              <p className="mt-1 text-xs text-muted">
                {requireReturn ? 'The refund follows when the item arrives.' : `The agent refunds the customer's ${request.itemName.toLowerCase()}.`}
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={() => submit('approve')} pending={mutation.isPending} autoFocus>
                  Approve
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button
            size="sm"
            variant={recommended === 'ask_customer' ? 'default' : 'secondary'}
            disabled={mutation.isPending}
            onClick={() => setDialog('ask')}
          >
            Ask customer
            <Kbd>Q</Kbd>
          </Button>
          <Button
            size="sm"
            variant={recommended === 'decline' ? 'default' : 'ghost'}
            disabled={mutation.isPending}
            onClick={() => setDialog('decline')}
          >
            Decline
            <Kbd>D</Kbd>
          </Button>
        </div>
      </footer>

      <NoteDialog
        open={dialog === 'ask'}
        onOpenChange={(open) => setDialog(open ? 'ask' : null)}
        title="Ask the customer"
        description={`${request.customerName} sees this question on their request page. Their answer starts the agent again.`}
        label="Question"
        max={500}
        initial={approval.draftQuestion ?? ''}
        placeholder="For example: Did you try new batteries?"
        submitLabel="Send question"
        pending={mutation.isPending}
        onSubmit={(note) => submit('ask_customer', note)}
      />
      <NoteDialog
        open={dialog === 'decline'}
        onOpenChange={(open) => setDialog(open ? 'decline' : null)}
        title="Decline this request"
        description="The agent turns your reason into a short, polite message for the customer."
        label="Reason for the customer"
        max={1000}
        initial=""
        placeholder="For example: Change-of-mind returns are possible within 30 days of delivery."
        submitLabel="Decline request"
        pending={mutation.isPending}
        onSubmit={(note) => submit('decline', note)}
      />
    </section>
  );
}

type NoteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  label: string;
  max: number;
  initial: string;
  placeholder: string;
  submitLabel: string;
  pending: boolean;
  onSubmit: (note: string) => void;
};

function NoteDialog({ open, onOpenChange, title, description, label, max, initial, placeholder, submitLabel, pending, onSubmit }: NoteDialogProps) {
  const [note, setNote] = useState(initial);
  const [touched, setTouched] = useState(false);
  const empty = !note.trim();

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setNote(initial);
          setTouched(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setTouched(true);
            if (!empty) onSubmit(note.trim());
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="mb-2 flex items-baseline justify-between">
              <Label htmlFor="staff-note">{label}</Label>
              <span className="text-xs text-subtle tabular">
                {note.length}/{max}
              </span>
            </div>
            <Textarea
              id="staff-note"
              rows={4}
              maxLength={max}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={placeholder}
              aria-invalid={touched && empty ? true : undefined}
              autoFocus
            />
            {touched && empty && (
              <p className="mt-2 flex items-center gap-1.5 text-13 text-rose">
                <CircleAlert className="size-3.5" aria-hidden />
                This field is required.
              </p>
            )}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" pending={pending}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
