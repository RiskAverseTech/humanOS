import type { UserRole } from '@/lib/supabase/types'

/**
 * Permission definitions per role.
 * Used both server-side (middleware, API routes) and client-side (UI gating).
 */
export const ROLE_PERMISSIONS = {
  admin: {
    canManageUsers: true,
    canInviteUsers: true,
    canGenerateImages: true,
    canUseAdvancedModels: true,
    canDeleteAnyNote: true,
    canViewAllContent: true,
  },
  partner: {
    canManageUsers: false,
    canInviteUsers: false,
    canGenerateImages: true,
    canUseAdvancedModels: true,
    canDeleteAnyNote: false,
    canViewAllContent: true,
  },
  child: {
    canManageUsers: false,
    canInviteUsers: false,
    canGenerateImages: false, // disabled by default
    canUseAdvancedModels: false,
    canDeleteAnyNote: false,
    canViewAllContent: false,
  },
} as const satisfies Record<UserRole, Record<string, boolean>>

export type Permission = keyof (typeof ROLE_PERMISSIONS)['admin']

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false
}

export function isAdult(role: UserRole): boolean {
  return role === 'admin' || role === 'partner'
}
