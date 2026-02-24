'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function ChatLandingRedirect({
  threadIds,
  fallbackThreadId,
}: {
  threadIds: string[]
  fallbackThreadId: string | null
}) {
  const router = useRouter()

  useEffect(() => {
    const lastThreadId = typeof window !== 'undefined'
      ? window.localStorage.getItem('last_ai_chat_thread_id')
      : null

    if (lastThreadId && threadIds.includes(lastThreadId)) {
      router.replace(`/chat/${lastThreadId}`)
      return
    }

    if (fallbackThreadId) {
      router.replace(`/chat/${fallbackThreadId}`)
    }
  }, [router, threadIds, fallbackThreadId])

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '60vh',
      gap: 'var(--space-3)',
      color: 'var(--color-text-muted)',
    }}>
      <span style={{ fontSize: '3rem' }}>💬</span>
      <p>Opening your latest chat...</p>
    </div>
  )
}

