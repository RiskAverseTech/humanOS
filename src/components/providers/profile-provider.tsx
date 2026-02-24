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
  timezonePreference?: string
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
    applyCustomBackgroundFromStorage()
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

function applyCustomBackgroundFromStorage() {
  try {
    const enabled = window.localStorage.getItem('famos_custom_bg_enabled') === 'true'
    const color = window.localStorage.getItem('famos_custom_bg_color') || '#f3f7ff'
    applyCustomBackground(enabled, color)
  } catch {
    // ignore localStorage access issues
  }
}

function applyCustomBackground(enabled: boolean, color: string) {
  const root = document.documentElement
  const body = document.body
  if (!enabled) {
    delete root.dataset.customBg
    delete body.dataset.customBg
    root.style.removeProperty('--user-custom-bg')
    root.style.removeProperty('--user-custom-bg-secondary')
    root.style.removeProperty('--user-custom-surface')
    root.style.removeProperty('--user-custom-surface-hover')
    root.style.removeProperty('--user-custom-border')
    return
  }

  const normalized = normalizeHex(color) ?? '#f3f7ff'
  const rgb = hexToRgb(normalized)
  if (!rgb) return

  root.dataset.customBg = 'on'
  body.dataset.customBg = 'on'
  root.style.setProperty('--user-custom-bg', normalized)
  root.style.setProperty('--user-custom-bg-secondary', mixRgb(rgb, { r: 255, g: 255, b: 255 }, 0.14))
  root.style.setProperty('--user-custom-surface', mixRgb(rgb, { r: 255, g: 255, b: 255 }, 0.32))
  root.style.setProperty('--user-custom-surface-hover', mixRgb(rgb, { r: 255, g: 255, b: 255 }, 0.22))
  root.style.setProperty('--user-custom-border', mixRgb(rgb, { r: 255, g: 255, b: 255 }, 0.46))
}

function normalizeHex(value: string): string | null {
  const raw = value.trim()
  if (!/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) return null
  if (raw.length === 4) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`.toLowerCase()
  }
  return raw.toLowerCase()
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHex(hex)
  if (!normalized) return null
  const int = Number.parseInt(normalized.slice(1), 16)
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  }
}

function mixRgb(
  base: { r: number; g: number; b: number },
  target: { r: number; g: number; b: number },
  targetWeight: number
): string {
  const w = Math.max(0, Math.min(1, targetWeight))
  const r = Math.round(base.r * (1 - w) + target.r * w)
  const g = Math.round(base.g * (1 - w) + target.g * w)
  const b = Math.round(base.b * (1 - w) + target.b * w)
  return `rgb(${r}, ${g}, ${b})`
}
