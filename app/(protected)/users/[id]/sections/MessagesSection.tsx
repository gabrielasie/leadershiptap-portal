import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import PlaceholderSection from '@/components/ui/PlaceholderSection'
import { formatMessageDate } from './helpers'
import type { Message } from '@/lib/types'

function StatusBadge({ status }: { status: 'Pending' | 'Sent' }) {
  if (status === 'Sent') {
    return (
      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200 flex-shrink-0">
        Sent
      </span>
    )
  }
  return (
    <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200 flex-shrink-0">
      Pending
    </span>
  )
}

function MessageRow({ msg, userId }: { msg: Message; userId: string }) {
  const subject = msg.subject ?? msg.messageName
  const bodyText = msg.body?.trim()
  const preview = bodyText
    ? bodyText.slice(0, 120) + (bodyText.length > 120 ? '…' : '')
    : null

  const inner = (
    <div className="px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 truncate">{subject}</p>
          {msg.created && (
            <p className="text-xs text-slate-400 mt-0.5">{formatMessageDate(msg.created)}</p>
          )}
          {preview ? (
            <p className="text-xs text-slate-500 mt-1 line-clamp-1">{preview}</p>
          ) : (
            <p className="text-xs text-slate-300 mt-1 italic">No content yet</p>
          )}
        </div>
        <StatusBadge status={msg.status} />
      </div>
    </div>
  )

  if (msg.meetingId) {
    return (
      <Link href={`/users/${userId}/meetings/${msg.meetingId}`} className="block">
        {inner}
      </Link>
    )
  }
  return <div>{inner}</div>
}

interface Props {
  messages: Message[]
  userId: string
  userCanWrite: boolean
}

export default function MessagesSection({ messages, userId, userCanWrite }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-900">Messages & Follow-ups</h2>
        </div>
        {userCanWrite && (
          <Link
            href={`/users/${userId}/messages/new`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(213,70%,30%)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[hsl(213,70%,25%)] transition-colors"
          >
            + Create Follow-up Draft
          </Link>
        )}
      </div>

      {messages.length === 0 ? (
        <PlaceholderSection
          icon={<MessageSquare />}
          title="No messages yet"
          message="Use the button above to draft a follow-up for this client."
        />
      ) : (
        <div className="rounded-lg border border-slate-100 overflow-hidden">
          {messages.map((msg) => (
            <MessageRow key={msg.id} msg={msg} userId={userId} />
          ))}
        </div>
      )}
    </div>
  )
}
