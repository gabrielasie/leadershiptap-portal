import Link from 'next/link'
import type { Message } from '@/lib/types'
import { Badge } from '@/components/ui/badge'

interface MessageHistoryProps {
  messages: Message[]
  userId: string
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function MessageRow({ msg, userId }: { msg: Message; userId: string }) {
  const inner = (
    <div className="px-4 py-3 space-y-1">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium truncate">{msg.subject ?? msg.messageName}</p>
        <Badge
          variant="secondary"
          className={
            msg.status === 'Sent'
              ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100 shrink-0'
              : 'bg-gray-100 text-gray-600 border-gray-200 shrink-0'
          }
        >
          {msg.status}
        </Badge>
      </div>
      {msg.created && (
        <p className="text-xs text-muted-foreground">{formatDate(msg.created)}</p>
      )}
      {msg.body && (
        <p className="text-xs text-muted-foreground">
          {msg.body.slice(0, 80)}{msg.body.length > 80 ? '…' : ''}
        </p>
      )}
    </div>
  )

  if (msg.meetingId) {
    return (
      <Link
        href={`/users/${userId}/meetings/${msg.meetingId}`}
        className="block hover:bg-muted/40 transition-colors"
      >
        {inner}
      </Link>
    )
  }

  return <div>{inner}</div>
}

export default function MessageHistory({ messages, userId }: MessageHistoryProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Message History</h2>
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">No messages yet.</p>
      ) : (
        <div className="rounded-md border divide-y">
          {messages.map((msg) => (
            <MessageRow key={msg.id} msg={msg} userId={userId} />
          ))}
        </div>
      )}
    </div>
  )
}
