'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { MessageSquare } from 'lucide-react'
import LogNoteDialog from './LogNoteDialog'
import LogSessionDialog from './LogSessionDialog'
import AddTaskDialog from './AddTaskDialog'

interface UserActionsBarProps {
  userId: string
}

export default function UserActionsBar({ userId }: UserActionsBarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button asChild size="sm">
        <Link href={`/users/${userId}/messages/new`}>
          <MessageSquare />
          Create Follow-up Draft
        </Link>
      </Button>

      <LogNoteDialog userId={userId} />
      <LogSessionDialog userId={userId} />
      <AddTaskDialog userId={userId} />
    </div>
  )
}
