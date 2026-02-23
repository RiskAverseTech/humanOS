import { notFound } from 'next/navigation'
import { getProfileNamesByUserIds } from '@/lib/supabase/profile'
import { getThread, getThreads, getMessages } from '../actions'
import { ChatLayout } from '../chat-layout'
import { ChatMessages } from '@/components/chat/chat-messages'

type Props = {
  params: Promise<{ id: string }>
}

export default async function ChatThreadPage({ params }: Props) {
  const { id } = await params
  const [thread, threads, messages] = await Promise.all([
    getThread(id),
    getThreads(),
    getMessages(id),
  ])

  if (!thread) {
    notFound()
  }

  const threadOwnerNames = await getProfileNamesByUserIds(
    Array.from(new Set([thread.owner_id, ...threads.map((t) => t.owner_id)]))
  )

  return (
    <ChatLayout threads={threads} threadOwnerNames={threadOwnerNames}>
      <ChatMessages
        thread={thread}
        initialMessages={messages}
        threadOwnerName={threadOwnerNames[thread.owner_id]}
      />
    </ChatLayout>
  )
}
