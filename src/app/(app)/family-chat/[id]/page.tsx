import { notFound } from 'next/navigation'
import { getProfileNamesByUserIds } from '@/lib/supabase/profile'
import { FamilyChatRoom } from '../room'
import { FamilyChatShell } from '../shell'
import { getFamilyChannel, getFamilyChannels, getFamilyMessages } from '../actions'

type Props = {
  params: Promise<{ id: string }>
}

export default async function FamilyChatChannelPage({ params }: Props) {
  const { id } = await params
  const [channel, channels, messages] = await Promise.all([
    getFamilyChannel(id),
    getFamilyChannels(),
    getFamilyMessages(id),
  ])

  if (!channel) notFound()

  const ownerNames = await getProfileNamesByUserIds([
    ...channels.map((c) => c.owner_id),
    ...messages.map((m) => m.author_id),
  ])

  return (
    <FamilyChatShell channels={channels}>
      <FamilyChatRoom
        channel={channel}
        messages={messages}
        ownerNames={ownerNames}
      />
    </FamilyChatShell>
  )
}
