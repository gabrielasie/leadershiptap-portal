'use server'

import { cookies } from 'next/headers'

export async function setViewModeCookie(mode: 'coach' | 'admin'): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set('lt_view_mode', mode, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    httpOnly: false,             // readable by client JS / localStorage sync
    sameSite: 'lax',
  })
}
