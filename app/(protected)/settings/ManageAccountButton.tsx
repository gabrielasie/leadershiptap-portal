'use client'

import { useClerk } from '@clerk/nextjs'

export default function ManageAccountButton() {
  const { openUserProfile } = useClerk()
  return (
    <button
      onClick={() => openUserProfile()}
      className="mt-4 text-sm font-medium text-[hsl(213,70%,30%)] hover:underline"
    >
      Manage Account →
    </button>
  )
}
