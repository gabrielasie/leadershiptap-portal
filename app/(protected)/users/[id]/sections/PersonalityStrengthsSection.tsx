import { Brain } from 'lucide-react'
import { SectionHeading, DescriptorText } from './helpers'
import type { User } from '@/lib/types'

interface Props {
  user: User
}

export default function PersonalityStrengthsSection({ user }: Props) {
  const hasPersonality =
    !!(user.enneagramType || user.enneagram || user.mbtiType || user.mbti ||
       user.conflictPosture || user.conflictPostureDescriptor ||
       user.apologyLanguage ||
       (user.strengths && user.strengths.length > 0))

  if (!hasPersonality) return null

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
      <SectionHeading icon={Brain} title="Personality & Strengths" />
      <div className="space-y-5">

        {(user.enneagramType || user.enneagram) && (
          <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Enneagram</p>
            <p className="text-sm font-medium text-slate-800">
              {user.enneagramType ?? user.enneagram}
            </p>
            {user.enneagramDescriptor && (
              <DescriptorText text={user.enneagramDescriptor} />
            )}
          </div>
        )}

        {(user.mbtiType || user.mbti) && (
          <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">MBTI</p>
            <p className="text-sm font-medium text-slate-800">
              {user.mbtiType ?? user.mbti}
            </p>
            {user.mbtiDescriptor && (
              <DescriptorText text={user.mbtiDescriptor} />
            )}
          </div>
        )}

        {(user.conflictPosture || user.conflictPostureDescriptor) && (
          <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Conflict Posture</p>
            {user.conflictPosture && (
              <p className="text-sm font-medium text-slate-800">{user.conflictPosture}</p>
            )}
            {user.conflictPostureDescriptor && (
              <DescriptorText text={user.conflictPostureDescriptor} />
            )}
          </div>
        )}

        {user.apologyLanguage && (
          <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Apology Language</p>
            <p className="text-sm font-medium text-slate-800">{user.apologyLanguage}</p>
            {user.apologyLanguageDescriptor && (
              <DescriptorText text={user.apologyLanguageDescriptor} />
            )}
          </div>
        )}

        {user.strengths && user.strengths.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Strengths</p>
            <ol className="space-y-1.5">
              {user.strengths.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-sm text-slate-800 font-medium">{s.name}</span>
                  {s.domain && (
                    <span className="text-xs text-slate-400 px-1.5 py-0.5 bg-slate-50 rounded">
                      {s.domain}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}

      </div>
    </div>
  )
}
