import { redirect } from 'next/navigation'
import { getProfile } from '@/lib/supabase/profile'
import { ProfileProvider, type ProfileContext } from '@/components/providers/profile-provider'
import { Sidebar } from '@/components/nav/sidebar'
import styles from './app-layout.module.css'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await getProfile()

  if (!profile) {
    redirect('/login')
  }

  const profileContext: ProfileContext = {
    id: profile.id,
    userId: profile.user_id,
    displayName: profile.display_name,
    role: profile.role,
    avatarUrl: profile.avatar_url,
    themePreference: profile.theme_preference,
  }

  return (
    <ProfileProvider profile={profileContext}>
      <div className={styles.layout} data-theme={profile.theme_preference}>
        <Sidebar />
        <main className={styles.main}>
          {children}
        </main>
      </div>
    </ProfileProvider>
  )
}
