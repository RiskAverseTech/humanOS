import { notFound } from 'next/navigation'
import { getProfile, getProfileNamesByUserIds, getProfileAvatarsByUserIds } from '@/lib/supabase/profile'
import { FamilyChatRoom } from '../room'
import { FamilyChatMembersPanel } from '../members-panel'
import { FamilyChatShell } from '../shell'
import { getFamilyChannel, getFamilyChannels, getFamilyMessages } from '../actions'

type Props = {
  params: Promise<{ id: string }>
}

export default async function FamilyChatChannelPage({ params }: Props) {
  const { id } = await params
  const [channel, channels, messages, currentProfile] = await Promise.all([
    getFamilyChannel(id),
    getFamilyChannels(),
    getFamilyMessages(id),
    getProfile(),
  ])

  if (!channel) notFound()

  const allUserIds = [
    ...channels.map((c) => c.owner_id),
    ...messages.map((m) => m.author_id),
  ]

  const [ownerNames, ownerAvatars] = await Promise.all([
    getProfileNamesByUserIds(allUserIds),
    getProfileAvatarsByUserIds(allUserIds),
  ])

  const participantIds = Array.from(new Set([channel.owner_id, ...messages.map((m) => m.author_id)]))
  if (currentProfile?.user_id && !participantIds.includes(currentProfile.user_id)) {
    participantIds.push(currentProfile.user_id)
  }
  const participants = participantIds
    .map((userId) => ({
      userId,
      name: ownerNames[userId] ?? 'Unknown',
      avatarUrl: ownerAvatars[userId] ?? null,
      badge: userId === channel.owner_id ? 'Owner' : undefined,
    }))
    .sort((a, b) => {
      if (a.badge === 'Owner' && b.badge !== 'Owner') return -1
      if (a.badge !== 'Owner' && b.badge === 'Owner') return 1
      return a.name.localeCompare(b.name)
    })

  return (
    <FamilyChatShell
      channels={channels}
      rightSidebar={<FamilyChatMembersPanel members={participants} />}
    >
      <FamilyChatRoom
        channel={channel}
        messages={messages}
        ownerNames={ownerNames}
        ownerAvatars={ownerAvatars}
      />
    </FamilyChatShell>
  )
}
