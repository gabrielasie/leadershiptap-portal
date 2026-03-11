'use client'

import type { Meeting } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

interface MeetingDetailModalProps {
  meeting: Meeting | null
  onClose: () => void
}

export default function MeetingDetailModal({ meeting, onClose }: MeetingDetailModalProps) {
  return (
    <Dialog open={!!meeting} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        {meeting && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg leading-snug">{meeting.title || 'Untitled Event'}</DialogTitle>
              <p className="text-sm text-muted-foreground pt-1">
                {formatDateTime(meeting.startTime)}
                {meeting.endTime && ` — ${formatDateTime(meeting.endTime)}`}
              </p>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              {/* Participants */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Participants
                </h3>
                {meeting.participantEmails.length > 0 ? (
                  <ul className="space-y-1">
                    {meeting.participantEmails.map((email) => (
                      <li key={email} className="text-sm">{email}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No participants listed.</p>
                )}
              </div>

              {/* Summary / Notes */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Transcript / Notes
                </h3>
                {meeting.syncedSummary ? (
                  <p className="text-sm whitespace-pre-wrap">{meeting.syncedSummary}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Not yet available.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
