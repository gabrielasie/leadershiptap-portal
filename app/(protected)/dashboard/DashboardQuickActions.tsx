'use client'

import Link from 'next/link'
import { FileText, CheckSquare, Calendar, History } from 'lucide-react'
import AddTaskDashboardDialog from './AddTaskDashboardDialog'
import LogSessionDashboardDialog from './LogSessionDashboardDialog'

interface Client {
  id: string
  name: string
}

interface Coach {
  id: string
  name: string
}

interface Props {
  clients: Client[]
  coaches: Coach[]
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

export default function DashboardQuickActions({ clients, coaches }: Props) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 mb-4 md:mb-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Quick Actions</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ActionCard
          icon={<FileText className="w-5 h-5 text-blue-600" />}
          iconBg="bg-blue-100"
          label="Log a Note"
          description="Record coaching observations"
        >
          <Link
            href="/sessions/new"
            className="block w-full min-h-[72px] rounded-xl border border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40 transition-colors"
          />
        </ActionCard>

        <LogSessionDashboardDialog
          clients={clients}
          trigger={
            <ActionCard
              icon={<History className="w-5 h-5 text-amber-600" />}
              iconBg="bg-amber-100"
              label="Log Session"
              description="Record a session manually"
            >
              <button className="w-full min-h-[72px] rounded-xl border border-slate-200 bg-white hover:border-amber-200 hover:bg-amber-50/40 transition-colors" />
            </ActionCard>
          }
        />

        <AddTaskDashboardDialog
          clients={clients}
          coaches={coaches}
          trigger={
            <ActionCard
              icon={<CheckSquare className="w-5 h-5 text-emerald-600" />}
              iconBg="bg-emerald-100"
              label="Add Task"
              description="Assign a follow-up"
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
