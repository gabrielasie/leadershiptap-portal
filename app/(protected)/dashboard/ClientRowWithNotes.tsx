'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, Calendar } from 'lucide-react'
import {
  dashboardSaveNoteAction,
  dashboardUpdateNoteAction,
  dashboardDeleteNoteAction,
} from './actions'

export interface ClientNote {
  id: string
  content: string
  date: string
}

export interface ClientRowProps {
  clientId: string
  clientName: string
  subtitle?: string | null         // "VP of Operations · Polaris Marine"
  initials: string
  avatarColorClass: string
  profilePhoto?: string | null
  notes: ClientNote[]              // sorted desc by date, up to ~10
  totalNoteCount: number           // for "View all N notes →"
  nextSessionLabel: string | null  // e.g. "Fri Apr 24 · 9:00 AM"
  lastSessionLabel: string | null  // e.g. "Fri Apr 17 · 11:30 AM"
}

function formatNoteDate(dateStr: string): string {
  if (!dateStr) return ''
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export default function ClientRowWithNotes({
  clientId,
  clientName,
  subtitle,
  initials,
  avatarColorClass,
  profilePhoto,
  notes,
  totalNoteCount,
  nextSessionLabel,
  lastSessionLabel,
}: ClientRowProps) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)

  // ── Edit state ───────────────────────────────────────────────────────────────
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [editDate, setEditDate] = useState('')
  const [editError, setEditError] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // ── Delete state ─────────────────────────────────────────────────────────────
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [executingDelete, setExecutingDelete] = useState(false)

  // ── Add note state ───────────────────────────────────────────────────────────
  const [addOpen, setAddOpen] = useState(false)
  const [addContent, setAddContent] = useState('')
  const [addDate, setAddDate] = useState(todayISO)
  const [addError, setAddError] = useState('')
  const [savingAdd, setSavingAdd] = useState(false)

  const mostRecentNote = notes[0] ?? null
  const previewText = mostRecentNote
    ? mostRecentNote.content.slice(0, 80) + (mostRecentNote.content.length > 80 ? '…' : '')
    : null

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function startEdit(note: ClientNote) {
    setEditingId(note.id)
    setEditContent(note.content)
    setEditDate(note.date ?? todayISO())
    setEditError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setEditError('')
  }

  async function saveEdit(noteId: string) {
    if (!editContent.trim()) { setEditError('Note cannot be empty.'); return }
    setEditError('')
    setSavingEdit(true)
    const result = await dashboardUpdateNoteAction(noteId, editContent.trim(), editDate)
    setSavingEdit(false)
    if (!result.success) { setEditError('Failed to save — try again.'); return }
    setEditingId(null)
    router.refresh()
  }

  async function executeDelete(noteId: string) {
    setDeleteError('')
    setExecutingDelete(true)
    const result = await dashboardDeleteNoteAction(noteId)
    setExecutingDelete(false)
    if (!result.success) { setDeleteError('Failed to delete — try again.'); return }
    setDeletingId(null)
    router.refresh()
  }

  function openAddNote() {
    setAddOpen(true)
    setAddContent('')
    setAddDate(todayISO())
    setAddError('')
  }

  async function saveAddNote() {
    if (!addContent.trim()) { setAddError('Note cannot be empty.'); return }
    setAddError('')
    setSavingAdd(true)
    const result = await dashboardSaveNoteAction(clientId, addContent.trim(), addDate)
    setSavingAdd(false)
    if (!result.success) { setAddError('Failed to save — try again.'); return }
    setAddOpen(false)
    router.refresh()
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="border-b border-slate-100 last:border-0">

      {/* ── Collapsed row: Link area + expand button ─────────────────────────── */}
      <div className="flex items-center rounded-lg hover:bg-slate-50 transition-colors duration-150 -mx-2 px-2">

        {/* Profile link — covers avatar + name + subtitle + note preview */}
        <Link
          href={`/users/${clientId}`}
          className="flex items-center gap-3 flex-1 min-w-0 py-[18px]"
        >
          {/* Avatar */}
          {profilePhoto ? (
            <img
              src={profilePhoto}
              alt={clientName}
              className="w-12 h-12 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${avatarColorClass}`}
            >
              {initials}
            </div>
          )}

          {/* Text block */}
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-slate-900 truncate leading-snug">
              {clientName}
            </p>
            {subtitle && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{subtitle}</p>
            )}
            <div className="mt-0.5">
              {previewText ? (
                <p className="text-xs text-slate-400 truncate">
                  {previewText}
                  {mostRecentNote?.date && (
                    <span className="text-slate-300"> · {formatNoteDate(mostRecentNote.date)}</span>
                  )}
                </p>
              ) : (
                <p className="text-xs text-slate-300 italic">No notes yet</p>
              )}
            </div>
          </div>
        </Link>

        {/* Expand/collapse button — chevron only */}
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse' : 'Expand notes'}
          className="flex-shrink-0 p-2 rounded-md hover:bg-slate-100 transition-colors"
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-slate-300" />
          )}
        </button>
      </div>

      {/* ── Expanded panel ───────────────────────────────────────────────────── */}
      {expanded && (
        <div className="pl-[60px] pb-5">

          {/* Notes header */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Recent Notes
            </p>
            <button
              onClick={openAddNote}
              className="flex items-center gap-1 text-xs font-medium text-[hsl(213,70%,30%)] hover:underline"
            >
              <Plus className="h-3 w-3" />
              Add Note
            </button>
          </div>

          {/* Add note inline form */}
          {addOpen && (
            <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50/30 p-3 space-y-2">
              <input
                type="date"
                value={addDate}
                onChange={(e) => setAddDate(e.target.value)}
                max={todayISO()}
                className="border border-slate-200 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
              <textarea
                autoFocus
                value={addContent}
                onChange={(e) => setAddContent(e.target.value)}
                placeholder="Session notes…"
                rows={3}
                className="w-full border border-slate-200 rounded-md px-2.5 py-2 text-sm bg-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              {addError && <p className="text-xs text-rose-500">{addError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={saveAddNote}
                  disabled={savingAdd}
                  className="px-3 py-1.5 bg-[hsl(213,70%,30%)] text-white text-xs font-medium rounded-md hover:bg-[hsl(213,70%,25%)] disabled:opacity-50 transition-colors"
                >
                  {savingAdd ? 'Saving…' : 'Save Note'}
                </button>
                <button
                  onClick={() => setAddOpen(false)}
                  className="px-3 py-1.5 border border-slate-200 text-xs rounded-md hover:bg-slate-50 transition-colors text-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Notes list */}
          {notes.length === 0 && !addOpen && (
            <p className="text-xs text-slate-400 italic mb-3">No notes yet.</p>
          )}

          <div className="space-y-1">
            {notes.slice(0, 3).map((note) => {

              // ── Delete confirm ──────────────────────────────────────────────
              if (note.id === deletingId) {
                return (
                  <div key={note.id} className="rounded-md border border-rose-200 bg-rose-50/40 p-3">
                    <p className="text-xs font-medium text-slate-700 mb-1">Delete this note?</p>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-3">{note.content}</p>
                    {deleteError && <p className="text-xs text-rose-500 mb-2">{deleteError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => executeDelete(note.id)}
                        disabled={executingDelete}
                        className="px-3 py-1 bg-rose-600 text-white text-xs font-medium rounded-md hover:bg-rose-700 disabled:opacity-50 transition-colors"
                      >
                        {executingDelete ? 'Deleting…' : 'Delete'}
                      </button>
                      <button
                        onClick={() => { setDeletingId(null); setDeleteError('') }}
                        className="px-3 py-1 border border-slate-200 text-xs rounded-md hover:bg-slate-50 transition-colors text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              }

              // ── Edit mode ───────────────────────────────────────────────────
              if (note.id === editingId) {
                return (
                  <div key={note.id} className="rounded-md border border-blue-200 bg-blue-50/30 p-3 space-y-2">
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="border border-slate-200 rounded-md px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                    <textarea
                      autoFocus
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={4}
                      className="w-full border border-slate-200 rounded-md px-2.5 py-2 text-sm bg-white resize-y focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    {editError && <p className="text-xs text-rose-500">{editError}</p>}
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(note.id)}
                        disabled={savingEdit}
                        className="px-3 py-1.5 bg-[hsl(213,70%,30%)] text-white text-xs font-medium rounded-md hover:bg-[hsl(213,70%,25%)] disabled:opacity-50 transition-colors"
                      >
                        {savingEdit ? 'Saving…' : 'Save'}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="px-3 py-1.5 border border-slate-200 text-xs rounded-md hover:bg-slate-50 transition-colors text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )
              }

              // ── View mode ───────────────────────────────────────────────────
              return (
                <div key={note.id} className="group flex items-start gap-2 py-1.5 -mx-1 px-1 rounded-md">
                  <div className="flex-1 min-w-0">
                    {note.date && (
                      <span className="text-xs font-medium text-slate-400 mr-1.5">
                        {formatNoteDate(note.date)} ·
                      </span>
                    )}
                    <span className="text-xs text-slate-600 leading-relaxed line-clamp-1">
                      {note.content}
                    </span>
                  </div>
                  <div className="flex-shrink-0 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(note)}
                      aria-label="Edit note"
                      className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => { setDeletingId(note.id); setDeleteError('') }}
                      aria-label="Delete note"
                      className="p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* View all notes link */}
          <div className="mt-2">
            <Link
              href={`/users/${clientId}`}
              className="text-xs font-medium text-[hsl(213,70%,30%)] hover:underline"
            >
              {totalNoteCount > 3
                ? `View all ${totalNoteCount} notes →`
                : 'View all notes on profile →'}
            </Link>
          </div>

          {/* Sessions section */}
          {(nextSessionLabel || lastSessionLabel) && (
            <div className="mt-4 pt-3 border-t border-slate-100 space-y-1">
              {nextSessionLabel && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-slate-400 flex-shrink-0" />
                  <span className="text-xs text-slate-500">
                    <span className="font-medium">Next session:</span> {nextSessionLabel}
                  </span>
                </div>
              )}
              {lastSessionLabel && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-slate-300 flex-shrink-0" />
                  <span className="text-xs text-slate-400">
                    <span className="font-medium">Last session:</span> {lastSessionLabel}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
