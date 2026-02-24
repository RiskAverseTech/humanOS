'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ProfileRow = {
  id: string
  user_id: string
  display_name: string
  role: string
  avatar_url: string | null
  created_at: string
}

export type AppBillingSettingsRow = {
  id: boolean
  billing_openai_gpt4o_input_per_mtok: number
  billing_openai_gpt4o_output_per_mtok: number
  billing_anthropic_sonnet_input_per_mtok: number
  billing_anthropic_sonnet_output_per_mtok: number
  billing_gpt_image_15_per_image: number
  billing_gpt_image_1_per_image: number
  billing_dalle3_per_image: number
  billing_fallback_image_per_image: number
  updated_at: string
  updated_by: string | null
}

/** Update the current user's profile */
export async function updateProfile(updates: {
  display_name?: string
  avatar_url?: string | null
  theme_preference?: 'light' | 'dark' | 'rose'
  timezone_preference?: string
  notifications_enabled?: boolean
  notification_categories?: Array<'notes' | 'vault' | 'todos' | 'human_chat' | 'ai_chat' | 'images'>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  let { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('user_id', user.id)

  if (error?.message?.includes('timezone_preference') && 'timezone_preference' in updates) {
    const fallbackUpdates = { ...updates }
    delete fallbackUpdates.timezone_preference
    const retry = await supabase
      .from('profiles')
      .update(fallbackUpdates)
      .eq('user_id', user.id)
    error = retry.error
  }

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/settings')
  revalidatePath('/dashboard')
  return { success: true }
}

/** Get all members (admin only) */
export async function getFamilyMembers(): Promise<ProfileRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // Verify admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return []

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true })

  return (data ?? []) as ProfileRow[]
}

/** Get pending invitations (admin only) */
export async function getPendingInvitations() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') return []

  const adminClient = createAdminClient()
  const { data } = await adminClient
    .from('invitations')
    .select('*')
    .is('accepted_at', null)
    .order('created_at', { ascending: false })

  return data ?? []
}

/** Update another user's role (admin only) */
export async function updateUserRole(profileId: string, role: 'admin' | 'partner' | 'child') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  // Verify admin
  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!myProfile || myProfile.role !== 'admin') {
    return { success: false, error: 'Admin only' }
  }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('profiles')
    .update({ role })
    .eq('id', profileId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

/** Revoke a pending invitation (admin only) */
export async function revokeInvitation(invitationId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from('invitations')
    .delete()
    .eq('id', invitationId)

  if (error) {
    return { success: false, error: error.message }
  }

  revalidatePath('/settings')
  return { success: true }
}

/** Update user password */
export async function updatePassword(newPassword: string) {
  const supabase = await createClient()

  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  })

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true }
}

/** Get billing estimate settings (visible to authenticated users) */
export async function getAppBillingSettings(): Promise<AppBillingSettingsRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', true)
    .single()

  return (data as AppBillingSettingsRow | null) ?? null
}

/** Update billing estimate settings (admin only) */
export async function updateAppBillingSettings(
  updates: Partial<
    Pick<
      AppBillingSettingsRow,
      | 'billing_openai_gpt4o_input_per_mtok'
      | 'billing_openai_gpt4o_output_per_mtok'
      | 'billing_anthropic_sonnet_input_per_mtok'
      | 'billing_anthropic_sonnet_output_per_mtok'
      | 'billing_gpt_image_15_per_image'
      | 'billing_gpt_image_1_per_image'
      | 'billing_dalle3_per_image'
      | 'billing_fallback_image_per_image'
    >
  >
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: myProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single()

  if (!myProfile || myProfile.role !== 'admin') {
    return { success: false, error: 'Admin only' }
  }

  const payload = {
    ...updates,
    updated_by: user.id,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('app_settings')
    .update(payload)
    .eq('id', true)

  if (error) return { success: false, error: error.message }

  revalidatePath('/settings')
  revalidatePath('/dashboard')
  return { success: true }
}
