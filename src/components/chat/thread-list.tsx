'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ThreadRow } from '@/app/(app)/chat/actions'
import styles from './thread-list.module.css'

type ThreadListProps = {
  threads: ThreadRow[]
  ownerNames: Record<string, string>
}

export function ThreadList({ threads, ownerNames }: ThreadListProps) {
  const pathname = usePathname()

  return (
    <div className={styles.list}>
      {threads.length === 0 ? (
        <p className={styles.empty}>No conversations yet</p>
      ) : (
        threads.map((thread) => {
          const isActive = pathname === `/chat/${thread.id}`
          return (
            <Link
              key={thread.id}
              href={`/chat/${thread.id}`}
              className={`${styles.item} ${isActive ? styles.active : ''}`}
            >
              <span className={styles.icon}>💬</span>
              <div className={styles.info}>
                <span className={styles.title}>{thread.title}</span>
                <span className={styles.meta}>
                  {ownerNames[thread.owner_id] ?? 'Unknown'} •{' '}
                  {new Date(thread.created_at).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </span>
              </div>
              {thread.is_shared && <span className={styles.shared}>Shared</span>}
            </Link>
          )
        })
      )}
    </div>
  )
}
