import { createClient } from './server'
import type { NotificationCategory, UserRole, ThemePreference } from './types'

export type Profile = {
  id: string
  user_id: string
  display_name: string
  role: UserRole
  avatar_url: string | null
  theme_preference: ThemePreference
  timezone_preference: string
  notifications_enabled: boolean
  notification_categories: NotificationCategory[]
  notifications_last_seen_at: string
  created_at: string
}

/**
 * Get the current user's profile from a Server Component.
 * Returns null if not authenticated or profile not found.
 */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return profile as Profile | null
}

/**
 * Get the current authenticated user or throw.
 * Use in server components/actions that require auth.
 */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) {
    throw new Error('Authentication required')
  }
  return profile
}

/**
 * Fetch display names for a set of user IDs (used to label shared content).
 */
export async function getProfileNamesByUserIds(userIds: string[]): Promise<Record<string, string>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)))
  if (uniqueIds.length === 0) return {}

  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('user_id, display_name')
    .in('user_id', uniqueIds)

  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    map[row.user_id] = row.display_name
  }
  return map
}

/**
 * Fetch avatar URLs for a set of user IDs.
 * Returns raw avatar_url values (may be storage paths or full URLs).
 */
export async function getProfileAvatarsByUserIds(userIds: string[]): Promise<Record<string, string | null>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)))
  if (uniqueIds.length === 0) return {}

  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('user_id, avatar_url')
    .in('user_id', uniqueIds)

  const map: Record<string, string | null> = {}
  for (const row of data ?? []) {
    map[row.user_id] = row.avatar_url
  }
  return map
}
