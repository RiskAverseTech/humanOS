import { getProfileNamesByUserIds } from '@/lib/supabase/profile'
import { getThreads } from './actions'
import { ChatLayout } from './chat-layout'

export default async function ChatPage() {
  const threads = await getThreads()
  const threadOwnerNames = await getProfileNamesByUserIds(threads.map((thread) => thread.owner_id))

  return (
    <ChatLayout threads={threads} threadOwnerNames={threadOwnerNames}>
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
        <p>Select a conversation or start a new one</p>
      </div>
    </ChatLayout>
  )
}
