'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { User } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function displayName(user: User): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  if (user.preferredName) return user.preferredName
  return user.email
}

interface UsersListProps {
  users: User[]
}

export default function UsersList({ users }: UsersListProps) {
  const [query, setQuery] = useState('')

  const filtered = query.trim()
    ? users.filter((u) => {
        const q = query.toLowerCase()
        return (
          displayName(u).toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.companyName ?? '').toLowerCase().includes(q)
        )
      })
    : users

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search by name, company, or email…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm h-11"
        aria-label="Search users"
      />

      {filtered.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          {query ? `No users match "${query}"` : 'No users found.'}
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="py-3">Name</TableHead>
                <TableHead className="py-3">Company</TableHead>
                <TableHead className="py-3">Email</TableHead>
                <TableHead className="py-3 w-24">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id} className="h-14">
                  <TableCell className="font-medium">
                    {displayName(user)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.companyName ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="outline" className="min-h-[44px]">
                      <Link href={`/users/${user.id}`}>View</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {filtered.length} of {users.length} users
      </p>
    </div>
  )
}
