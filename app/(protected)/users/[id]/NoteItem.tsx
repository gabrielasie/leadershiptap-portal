'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateNoteAction, deleteNoteAction } from './actions'
import NoteBody from '@/components/notes/NoteBody'
import type { Note } from '@/lib/types'

/**
 * Splits a Note body into its typed-caption portion and any embedded ink
 * image URLs. Used so edit mode can change the caption without destroying
 * the attached image — the rebuilt body re-appends the image markdown after
 * the new caption.
 */
const IMG_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g

function splitNoteBody(body: string): { caption: string; images: Array<{ alt: string; url: string }> } {
  const images: Array<{ alt: string; url: string }> = []
  const stripped = body.replace(IMG_RE, (_match, alt: string, url: string) => {
    images.push({ alt: alt || 'Ink note', url })
    return ''
  })
  return { caption: stripped.trim(), images }
}

function rebuildNoteBody(caption: string, images: Array<{ alt: string; url: string }>): string {
  if (images.length === 0) return caption
  const captionBlock = caption.trim()
  const imageBlock = images.map((img) => `![${img.alt}](${img.url})`).join('\n')
  return captionBlock ? `${captionBlock}\n\n${imageBlock}` : imageBlock
}

function formatNoteDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

export default function NoteItem({ note }: { note: Note }) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit' | 'confirmDelete'>('view')
  // Editing tracks the typed caption separately from any embedded ink images.
  // This way edit mode preserves attached images instead of forcing the user
  // to retype + re-attach.
  const initialSplit = splitNoteBody(note.content)
  const [caption, setCaption] = useState(initialSplit.caption)
  const [content, setContent] = useState(note.content)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const hasInkImage = initialSplit.images.length > 0

  async function handleSave() {
    const body = hasInkImage
      ? rebuildNoteBody(caption, initialSplit.images)
      : caption
    if (!body.trim()) { setError('Note cannot be empty.'); return }
    setSaving(true)
    setError('')
    const result = await updateNoteAction(note.id, body.trim())
    setSaving(false)
    if (result.success) {
      setContent(body.trim())
      setMode('view')
      router.refresh()
    } else {
      setError('Failed to save — please try again.')
    }
  }

  function handleCancel() {
    setCaption(initialSplit.caption)
    setError('')
    setMode('view')
  }

  async function handleDelete() {
    setDeleting(true)
    const result = await deleteNoteAction(note.id)
    setDeleting(false)
    if (result.success) {
      router.refresh()
    } else {
      setError('Failed to delete — please try again.')
      setMode('view')
    }
  }

  // ── VIEW ──────────────────────────────────────────────────────────────────
  if (mode === 'view') {
    return (
      <div className="group relative rounded-lg border border-slate-100 hover:border-slate-200 p-4 transition-colors">
        {/* Hover action buttons */}
        <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setMode('edit')}
            className="text-xs px-2 py-1 rounded border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => setMode('confirmDelete')}
            className="text-xs px-2 py-1 rounded border border-rose-100 bg-white hover:bg-rose-50 text-rose-400 hover:text-rose-600 transition-colors"
          >
            Delete
          </button>
        </div>

        <div className="pr-20">
          <NoteBody content={content} />
        </div>
        {note.date && (
          <p className="text-xs font-medium text-slate-400 mt-2">
            {formatNoteDate(note.date)}
          </p>
        )}
      </div>
    )
  }

  // ── EDIT ──────────────────────────────────────────────────────────────────
  if (mode === 'edit') {
    return (
      <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-4">
        {hasInkImage && (
          <div className="mb-3">
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Ink (preserved)</p>
            {initialSplit.images.map((img, i) => (
              <img
                key={i}
                src={img.url}
                alt={img.alt}
                className="block w-full object-contain rounded-md border border-slate-200 bg-white max-h-60 mb-1.5"
              />
            ))}
            <p className="text-xs text-slate-400">
              The ink stays attached. To redraw, delete this note and create a new ink note.
            </p>
          </div>
        )}
        <div className="mb-3">
          <label className="text-xs font-semibold text-slate-500 block mb-1">
            {hasInkImage ? 'Caption' : 'Note'}
          </label>
          <textarea
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={hasInkImage ? 2 : 5}
            placeholder={hasInkImage ? 'Optional caption…' : undefined}
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm bg-white resize-y focus:outline-none focus:ring-2 focus:ring-blue-400 leading-relaxed"
          />
        </div>
        {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-[hsl(213,70%,30%)] text-white text-sm font-medium rounded-lg hover:bg-[hsl(213,70%,25%)] disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            className="px-4 py-2 border border-slate-200 text-sm rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  // ── CONFIRM DELETE ────────────────────────────────────────────────────────
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50/30 p-4">
      <p className="text-sm font-semibold text-slate-800 mb-1">Delete this note?</p>
      <p className="text-sm text-slate-500 mb-4 line-clamp-2">{content}</p>
      {error && <p className="text-xs text-rose-500 mb-3">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="px-4 py-2 bg-rose-600 text-white text-sm font-medium rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors"
        >
          {deleting ? 'Deleting…' : 'Yes, delete'}
        </button>
        <button
          onClick={() => { setMode('view'); setError('') }}
          className="px-4 py-2 border border-slate-200 text-sm rounded-lg hover:bg-slate-50 transition-colors text-slate-600"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
