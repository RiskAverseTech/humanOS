'use client'

import { useEffect, useState } from 'react'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import styles from './members-panel.module.css'

type Member = {
  userId: string
  name: string
  avatarUrl: string | null
  badge?: string
}

export function FamilyChatMembersPanel({
  members,
}: {
  members: Member[]
}) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    let active = true
    async function load() {
      const supabase = createBrowserSupabaseClient()
      const next: Record<string, string> = {}
      for (const member of members) {
        const raw = member.avatarUrl
        if (!raw) continue
        if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) {
          next[member.userId] = raw
          continue
        }
        const { data } = await supabase.storage.from('avatars').createSignedUrl(raw, 3600)
        if (data?.signedUrl) next[member.userId] = data.signedUrl
      }
      if (active) setSignedUrls(next)
    }
    void load()
    return () => {
      active = false
    }
  }, [members])

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h3 className={styles.title}>In This Chat</h3>
        <p className={styles.subtitle}>{members.length} member{members.length === 1 ? '' : 's'}</p>
      </div>

      <div className={styles.list}>
        {members.map((member) => (
          <div key={member.userId} className={styles.item}>
            <div className={styles.avatar}>
              {signedUrls[member.userId] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={signedUrls[member.userId]} alt="" className={styles.avatarImg} />
              ) : (
                member.name.charAt(0).toUpperCase()
              )}
            </div>
            <span className={styles.name}>{member.name}</span>
            {member.badge && <span className={styles.badge}>{member.badge}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
