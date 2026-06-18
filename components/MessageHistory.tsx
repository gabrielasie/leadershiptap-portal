import Link from 'next/link'
import { Mail } from 'lucide-react'
import type { Message } from '@/lib/types'

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

function StatusBadge({ status }: { status: 'Pending' | 'Sent' }) {
  if (status === 'Sent') {
    return (
      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200 shrink-0">
        Sent
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200 shrink-0">
      Pending
    </span>
  )
}

function MessageRow({ msg, userId }: { msg: Message; userId: string }) {
  const subject = msg.subject ?? msg.messageName
  const preview = msg.body ? msg.body.slice(0, 120) + (msg.body.length > 120 ? '…' : '') : null

  const inner = (
    <div className="px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">{subject}</p>
          {msg.created && (
            <p className="text-xs text-gray-400 mt-0.5">{formatDate(msg.created)}</p>
          )}
          {preview && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{preview}</p>
          )}
        </div>
        <StatusBadge status={msg.status} />
      </div>
    </div>
  )

  if (msg.meetingId) {
    return (
      <Link
        href={`/users/${userId}/meetings/${msg.meetingId}`}
        className="block"
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
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Message History</h2>
      {messages.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-10 text-center">
          <Mail className="mx-auto h-8 w-8 text-gray-300 mb-2" />
          <p className="text-sm text-gray-400">No messages yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {messages.map((msg) => (
            <MessageRow key={msg.id} msg={msg} userId={userId} />
          ))}
        </div>
      )}
    </div>
  )
}
