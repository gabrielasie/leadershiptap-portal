import { redirect } from 'next/navigation'

// Standalone meeting detail pages have been replaced by
// /users/[id]/sessions/[meetingId] — redirect to dashboard.
export default function StandaloneMeetingPage() {
  redirect('/dashboard')
}
