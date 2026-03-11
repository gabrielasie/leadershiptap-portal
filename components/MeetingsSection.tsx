'use client'

import { useState } from 'react'
import type { Meeting } from '@/lib/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import MeetingDetailModal from '@/components/MeetingDetailModal'

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function MeetingRow({
  meeting,
  onView,
}: {
  meeting: Meeting
  onView: (m: Meeting) => void
}) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b last:border-b-0 min-h-[56px]">
      <div className="space-y-0.5">
        <p className="font-medium text-sm">{meeting.title}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(meeting.startTime)}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <span className="text-xs text-muted-foreground">
          {meeting.participantEmails.length} participant
          {meeting.participantEmails.length !== 1 ? 's' : ''}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px]"
          onClick={() => onView(meeting)}
        >
          View
        </Button>
      </div>
    </div>
  )
}

function MeetingList({
  meetings,
  onView,
}: {
  meetings: Meeting[]
  onView: (m: Meeting) => void
}) {
  if (meetings.length === 0) {
    return (
      <p className="py-10 text-center text-muted-foreground text-sm">
        No meetings found.
      </p>
    )
  }
  return (
    <div className="rounded-md border">
      {meetings.map((m) => (
        <MeetingRow key={m.id} meeting={m} onView={onView} />
      ))}
    </div>
  )
}

interface MeetingsSectionProps {
  upcoming: Meeting[]
  past: Meeting[]
}

export default function MeetingsSection({ upcoming, past }: MeetingsSectionProps) {
  const [selected, setSelected] = useState<Meeting | null>(null)

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Meetings</h2>
      <Tabs defaultValue="upcoming">
        <TabsList className="mb-4">
          <TabsTrigger value="upcoming" className="min-h-[44px] px-5">
            Upcoming {upcoming.length > 0 && `(${upcoming.length})`}
          </TabsTrigger>
          <TabsTrigger value="past" className="min-h-[44px] px-5">
            Past {past.length > 0 && `(${past.length})`}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          <MeetingList meetings={upcoming} onView={setSelected} />
        </TabsContent>
        <TabsContent value="past">
          <MeetingList meetings={past} onView={setSelected} />
        </TabsContent>
      </Tabs>

      <MeetingDetailModal meeting={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
