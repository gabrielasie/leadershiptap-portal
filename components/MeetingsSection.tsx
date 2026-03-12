'use client'

import Link from 'next/link'
import type { Meeting } from '@/lib/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'

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

function MeetingRow({ meeting, userId }: { meeting: Meeting; userId: string }) {
  return (
    <div className="flex items-center justify-between py-3 px-4 border-b last:border-b-0 min-h-[56px]">
      <div className="space-y-0.5">
        <p className="font-medium text-sm">{meeting.title || 'Untitled Event'}</p>
        <p className="text-xs text-muted-foreground">{formatDateTime(meeting.startTime)}</p>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-4">
        <span className="text-xs text-muted-foreground">
          {meeting.participantEmails.length} participant
          {meeting.participantEmails.length !== 1 ? 's' : ''}
        </span>
        <Button asChild variant="outline" size="sm" className="min-h-[44px]">
          <Link href={`/users/${userId}/meetings/${meeting.id}`}>View</Link>
        </Button>
      </div>
    </div>
  )
}

function MeetingList({ meetings, userId }: { meetings: Meeting[]; userId: string }) {
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
        <MeetingRow key={m.id} meeting={m} userId={userId} />
      ))}
    </div>
  )
}

interface MeetingsSectionProps {
  upcoming: Meeting[]
  past: Meeting[]
  userId: string
}

export default function MeetingsSection({ upcoming, past, userId }: MeetingsSectionProps) {
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
          <MeetingList meetings={upcoming} userId={userId} />
        </TabsContent>
        <TabsContent value="past">
          <MeetingList meetings={past} userId={userId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
