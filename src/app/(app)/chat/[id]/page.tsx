import { notFound } from 'next/navigation'
import { getProfile, getProfileNamesByUserIds, getProfileAvatarsByUserIds } from '@/lib/supabase/profile'
import { getThread, getThreads, getMessages } from '../actions'
import { ChatLayout } from '../chat-layout'
import { ChatMessages } from '@/components/chat/chat-messages'
import { FamilyChatMembersPanel } from '@/app/(app)/family-chat/members-panel'

type Props = {
  params: Promise<{ id: string }>
}

export default async function ChatThreadPage({ params }: Props) {
  const { id } = await params
  const [thread, threads, messages, currentProfile] = await Promise.all([
    getThread(id),
    getThreads(),
    getMessages(id),
    getProfile(),
  ])

  if (!thread) {
    notFound()
  }

  // Collect all user IDs: thread owners + message senders
  const allUserIds = Array.from(new Set([
    thread.owner_id,
    ...threads.map((t) => t.owner_id),
    ...messages.filter((m) => m.sender_id).map((m) => m.sender_id!),
    ...(currentProfile?.user_id ? [currentProfile.user_id] : []),
  ]))

  const [threadOwnerNames, memberAvatars] = await Promise.all([
    getProfileNamesByUserIds(allUserIds),
    getProfileAvatarsByUserIds(allUserIds),
  ])

  const humanParticipantIds = Array.from(
    new Set([
      ...(messages.map((m) => m.sender_id).filter(Boolean) as string[]),
      ...(currentProfile?.user_id ? [currentProfile.user_id] : []),
    ])
  )

  const humanParticipants = humanParticipantIds
    .map((userId) => ({
      userId,
      name: threadOwnerNames[userId] ?? 'Unknown',
      avatarUrl: memberAvatars[userId] ?? null,
      badge: userId === thread.owner_id ? 'Owner' : undefined,
    }))

  const aiParticipants = [
    ...humanParticipants,
    {
      userId: 'famos-ai',
      name: getAiDisplayName(thread.model),
      avatarUrl: '/ai.png',
      badge: 'AI',
    },
  ].sort((a, b) => {
    const rank = (badge?: string) => (badge === 'Owner' ? 0 : badge === 'AI' ? 1 : 2)
    const diff = rank(a.badge) - rank(b.badge)
    return diff !== 0 ? diff : a.name.localeCompare(b.name)
  })

  return (
    <ChatLayout
      threads={threads}
      threadOwnerNames={threadOwnerNames}
      rightSidebar={<FamilyChatMembersPanel members={aiParticipants} />}
    >
      <ChatMessages
        thread={thread}
        initialMessages={messages}
        threadOwnerName={threadOwnerNames[thread.owner_id]}
        memberNames={threadOwnerNames}
        memberAvatars={memberAvatars}
      />
    </ChatLayout>
  )
}

function getAiDisplayName(modelId: string): string {
  const value = modelId.toLowerCase()
  if (value.includes('claude')) return 'Claude AI'
  if (value.includes('gpt') || value.includes('openai') || value.includes('o1') || value.includes('o3')) {
    return 'ChatGPT AI'
  }
  return 'AI'
}
