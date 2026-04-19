'use client'

import { FileText, CheckSquare, Calendar } from 'lucide-react'
import GlobalLogNoteDialog from './GlobalLogNoteDialog'
import AddTaskDashboardDialog from './AddTaskDashboardDialog'

interface Client {
  id: string
  name: string
}

interface Props {
  clients: Client[]
}

// ── Shared card shell ─────────────────────────────────────────────────────────

function ActionCard({
  icon,
  iconBg,
  label,
  description,
  children,
}: {
  icon: React.ReactNode
  iconBg: string
  label: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="relative">
      {children}
      {/* Non-interactive label layer — pointer-events-none so the trigger above captures clicks */}
      <div className="pointer-events-none absolute inset-0 flex items-center gap-4 px-5 rounded-xl">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        <div className="text-left">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          <p className="text-xs text-slate-400 mt-0.5">{description}</p>
        </div>
      </div>
    </div>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function DashboardQuickActions({ clients }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 mb-4 md:mb-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Quick Actions</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <GlobalLogNoteDialog
          clients={clients}
          trigger={
            <ActionCard
              icon={<FileText className="w-5 h-5 text-blue-600" />}
              iconBg="bg-blue-100"
              label="Log a Note"
              description="Record coaching observations"
            >
              <button className="w-full min-h-[72px] rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40 transition-colors" />
            </ActionCard>
          }
        />
        <AddTaskDashboardDialog
          clients={clients}
          trigger={
            <ActionCard
              icon={<CheckSquare className="w-5 h-5 text-emerald-600" />}
              iconBg="bg-emerald-100"
              label="Add Task"
              description="Assign a follow-up to a client"
            >
              <button className="w-full min-h-[72px] rounded-xl border border-slate-200 bg-white hover:border-emerald-200 hover:bg-emerald-50/40 transition-colors" />
            </ActionCard>
          }
        />
        <ActionCard
          icon={<Calendar className="w-5 h-5 text-violet-600" />}
          iconBg="bg-violet-100"
          label="My Schedule"
          description="Jump to upcoming sessions"
        >
          <a
            href="#upcoming"
            className="block w-full min-h-[72px] rounded-xl border border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40 transition-colors"
          />
        </ActionCard>
      </div>
    </div>
  )
}
