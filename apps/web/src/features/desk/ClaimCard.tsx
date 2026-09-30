import { Chip } from '@/components/Chip';
import { PersonAvatar } from '@/components/Avatars';
import { PhotoLightbox } from '@/components/PhotoLightbox';
import { RelativeTime } from '@/components/RelativeTime';
import { REASONS } from '@/lib/status';
import type { RefundRequest, Reply } from '@/lib/types';
import { Panel } from './Panel';

/** What the customer said, with their photos. Customer text is a claim for the agent to check. */
export function ClaimCard({ request, replies }: { request: RefundRequest; replies: Reply[] }) {
  const reason = REASONS[request.reason];
  return (
    <Panel title="Customer claim" aside={<Chip icon={reason.icon}>{reason.label}</Chip>}>
      <div className="flex gap-4 px-5 py-4">
        <blockquote className="max-h-60 min-w-0 flex-1 overflow-y-auto text-13 leading-5 whitespace-pre-line text-foreground/90 scrollbar-thin">
          <span className="text-subtle">“</span>
          {request.details}
          <span className="text-subtle">”</span>
        </blockquote>
        {request.photoId && request.photoToken && (
          <PhotoLightbox
            fileId={request.photoId}
            token={request.photoToken}
            label={`Photo from ${request.customerName}`}
            caption={request.itemName}
            className="size-30 shrink-0"
          />
        )}
      </div>
      {replies.length > 0 && (
        <ol className="border-t border-border">
          {replies.map((reply) => (
            <li key={reply.$id} className="flex gap-3 border-b border-border px-5 py-4 last:border-b-0">
              <PersonAvatar name={request.customerName} size="xs" className="mt-px" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted">
                  <span className="font-medium text-foreground">{request.customerName}</span> answered{' '}
                  <RelativeTime value={reply.$createdAt} format="ago" />
                </p>
                <p className="mt-1 text-13 whitespace-pre-line text-foreground/90">{reply.message}</p>
              </div>
              {reply.photoId && reply.photoToken && (
                <PhotoLightbox
                  fileId={reply.photoId}
                  token={reply.photoToken}
                  label={`Photo from ${request.customerName}'s answer`}
                  className="size-20 shrink-0"
                />
              )}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
