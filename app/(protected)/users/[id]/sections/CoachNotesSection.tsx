import { BookOpen } from 'lucide-react'
import NoteItem from '../NoteItem'
import type { Note } from '@/lib/types'

interface Props {
  sessionNotes: Note[]
  userCanWrite: boolean
}

export default function CoachNotesSection({ sessionNotes, userCanWrite }: Props) {
  if (!userCanWrite) return null

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <BookOpen className="h-5 w-5 text-slate-400" />
        <h2 className="text-lg font-semibold text-slate-900">Coach Notes</h2>
      </div>
      {sessionNotes.length === 0 ? (
        <p className="text-sm text-slate-400">No coach notes yet — use the Log a Note button above.</p>
      ) : (
        <div className="space-y-3">
          {sessionNotes.map((note) => (
            <NoteItem key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  )
}
