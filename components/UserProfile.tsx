import Link from 'next/link'
import type { User } from '@/lib/types'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

function displayName(user: User): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.email
}

interface UserProfileProps {
  user: User
}

export default function UserProfile({ user }: UserProfileProps) {
  const name = displayName(user)
  const contactEmail = user.workEmail ?? user.email

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{name}</h1>
            {user.preferredName && user.preferredName !== name && (
              <p className="text-muted-foreground text-sm mt-0.5">
                Goes by &ldquo;{user.preferredName}&rdquo;
              </p>
            )}
          </div>
          <Button asChild variant="outline" size="sm" className="min-h-[44px] shrink-0">
            <Link href="/users">← Back</Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {user.jobTitle && (
            <div>
              <span className="text-muted-foreground">Title</span>
              <p className="font-medium mt-0.5">{user.jobTitle}</p>
            </div>
          )}
          {user.companyName && (
            <div>
              <span className="text-muted-foreground">Company</span>
              <p className="font-medium mt-0.5">{user.companyName}</p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Email</span>
            <p className="font-medium mt-0.5">{contactEmail}</p>
          </div>
          {user.role && (
            <div>
              <span className="text-muted-foreground">Role</span>
              <p className="font-medium mt-0.5">{user.role}</p>
            </div>
          )}
        </div>

        {(user.enneagram || user.mbti) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {user.enneagram && (
              <Badge variant="secondary">Enneagram {user.enneagram}</Badge>
            )}
            {user.mbti && (
              <Badge variant="secondary">{user.mbti}</Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
