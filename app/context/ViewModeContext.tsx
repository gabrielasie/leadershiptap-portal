'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { setViewModeCookie } from '@/app/actions/viewMode'

export type ViewMode = 'coach' | 'admin'

interface ViewModeContextValue {
  mode: ViewMode
  setMode: (mode: ViewMode) => void
  isCoachView: boolean
  isAdminView: boolean
  currentCoachAirtableId: string | null
}

const ViewModeContext = createContext<ViewModeContextValue>({
  mode: 'coach',
  setMode: () => {},
  isCoachView: true,
  isAdminView: false,
  currentCoachAirtableId: null,
})

export function ViewModeProvider({
  children,
  initialMode,
  currentCoachAirtableId,
}: {
  children: React.ReactNode
  initialMode: ViewMode
  currentCoachAirtableId: string | null
}) {
  const router = useRouter()
  const [mode, setModeState] = useState<ViewMode>(initialMode)

  // On mount, let localStorage override the cookie initial value (localStorage
  // may be more up-to-date if the user changed mode while offline or the cookie
  // hadn't propagated yet).
  useEffect(() => {
    const stored = localStorage.getItem('lt_view_mode')
    if (stored === 'coach' || stored === 'admin') {
      setModeState(stored)
    }
  }, [])

  const setMode = useCallback(
    async (newMode: ViewMode) => {
      setModeState(newMode)
      localStorage.setItem('lt_view_mode', newMode)
      // Persist in cookie so the server can read it on next render
      await setViewModeCookie(newMode)
      // Soft-refresh server components so filtered data re-fetches
      router.refresh()
    },
    [router],
  )

  return (
    <ViewModeContext.Provider
      value={{
        mode,
        setMode,
        isCoachView: mode === 'coach',
        isAdminView: mode === 'admin',
        currentCoachAirtableId,
      }}
    >
      {children}
    </ViewModeContext.Provider>
  )
}

export function useViewMode(): ViewModeContextValue {
  return useContext(ViewModeContext)
}
