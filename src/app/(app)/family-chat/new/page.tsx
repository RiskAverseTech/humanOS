import { getFamilyChannels } from '../actions'
import { FamilyChatShell } from '../shell'

export default async function FamilyChatNewPage() {
  const channels = await getFamilyChannels()

  return (
    <FamilyChatShell channels={channels}>
      <div style={{ display: 'grid', placeItems: 'center', height: '60vh', color: 'var(--color-text-muted)' }}>
        <p>Create a channel to start chatting with your family.</p>
      </div>
    </FamilyChatShell>
  )
}
