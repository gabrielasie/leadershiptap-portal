import { Heart } from 'lucide-react'
import { SectionHeading, hasRealContent } from './helpers'
import type { User } from '@/lib/types'
import type { CoachPersonContext } from '@/lib/airtable/coachPersonContext'

interface Props {
  user: User
  coachContext: CoachPersonContext | null
}

export default function CoachingContextSection({ user, coachContext }: Props) {
  const sections = [
    hasRealContent(user.internalNotes) ? user.internalNotes! : null,
    hasRealContent(coachContext?.quickNotes ?? undefined) ? coachContext!.quickNotes : null,
    hasRealContent(coachContext?.familyDetails ?? undefined) ? coachContext!.familyDetails : null,
  ].filter((s): s is string => s !== null)

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      <SectionHeading icon={Heart} title="Coaching Context" />
      {sections.length === 0 ? (
        <p className="text-sm text-slate-400 italic">No context added yet — use Edit Profile to add notes.</p>
      ) : (
        <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
          {sections.map((text, i) => (
            <div key={i}>
              {i > 0 && <hr className="my-3 border-slate-100" />}
              {text}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
