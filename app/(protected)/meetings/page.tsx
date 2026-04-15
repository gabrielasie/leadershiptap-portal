import { redirect } from 'next/navigation'

// The standalone meetings list has been replaced by per-client session history.
// Redirect any direct visits to the dashboard.
export default function MeetingsPage() {
  redirect('/dashboard')
}
