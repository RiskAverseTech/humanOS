'use client'

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import type { UserRole, ThemePreference } from '@/lib/supabase/types'

export type ProfileContext = {
  id: string
  userId: string
  displayName: string
  role: UserRole
  avatarUrl: string | null
  themePreference: ThemePreference
}

const Context = createContext<ProfileContext | null>(null)

export function ProfileProvider({
  profile,
  children,
}: {
  profile: ProfileContext
  children: ReactNode
}) {
  useEffect(() => {
    document.documentElement.dataset.theme = profile.themePreference
    document.body.dataset.theme = profile.themePreference
  }, [profile.themePreference])

  return <Context.Provider value={profile}>{children}</Context.Provider>
}

export function useProfile(): ProfileContext {
  const context = useContext(Context)
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return context
}
