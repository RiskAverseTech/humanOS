import { getProfile } from '@/lib/supabase/profile'
import { getAppBillingSettings, getFamilyMembers, getPendingInvitations } from './actions'
import { SettingsClient } from './settings-client'

export default async function SettingsPage() {
  const profile = await getProfile()
  const [members, invitations, billingSettings] = await Promise.all([
    getFamilyMembers(),
    getPendingInvitations(),
    getAppBillingSettings(),
  ])

  return (
    <SettingsClient
      profile={profile!}
      members={members}
      invitations={invitations}
      billingSettings={billingSettings}
    />
  )
}
