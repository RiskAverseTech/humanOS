import { redirect } from 'next/navigation'
import { getFamilyChannels } from './actions'

export default async function FamilyChatIndexPage() {
  const channels = await getFamilyChannels()
  if (channels.length > 0) {
    redirect(`/family-chat/${channels[0].id}`)
  }
  redirect('/family-chat/new')
}
