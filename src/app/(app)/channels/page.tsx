import { redirect } from 'next/navigation'
import { getFamilyChannels } from './actions'

export default async function HumanChatIndexPage() {
  const channels = await getFamilyChannels()
  if (channels.length > 0) {
    redirect(`/channels/${channels[0].id}`)
  }
  redirect('/channels/new')
}
