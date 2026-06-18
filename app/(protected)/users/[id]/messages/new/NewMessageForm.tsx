'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { saveDraftAction } from './actions'

interface NewMessageFormProps {
  userId: string
  defaultSubject: string
  defaultBody: string
}

export default function NewMessageForm({ userId, defaultSubject, defaultBody }: NewMessageFormProps) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      action={(formData) => saveDraftAction(userId, formData)}
      className="space-y-5"
    >
      {/* Subject */}
      <div>
        <label htmlFor="subject" className="block text-sm font-medium text-slate-700 mb-1.5">
          Subject
        </label>
        <input
          id="subject"
          name="subject"
          type="text"
          defaultValue={defaultSubject}
          required
          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)]/30 focus:border-[hsl(213,70%,30%)]"
        />
      </div>

      {/* Body */}
      <div>
        <label htmlFor="body" className="block text-sm font-medium text-slate-700 mb-1.5">
          Message
        </label>
        <textarea
          id="body"
          name="body"
          rows={12}
          defaultValue={defaultBody}
          placeholder="Write your follow-up message here…"
          className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 shadow-sm resize-y focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)]/30 focus:border-[hsl(213,70%,30%)]"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          className="rounded-lg bg-[hsl(213,70%,30%)] px-5 py-2.5 text-sm font-medium text-white hover:bg-[hsl(213,70%,25%)] transition-colors"
        >
          Save Draft
        </button>
        <Link
          href={`/users/${userId}`}
          className="rounded-lg px-5 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          Cancel
        </Link>
      </div>
    </form>
  )
}
