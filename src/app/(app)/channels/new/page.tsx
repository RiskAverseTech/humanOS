import { getFamilyChannels } from '../actions'
import { HumanChatShell } from '../shell'

export default async function HumanChatNewPage() {
  const channels = await getFamilyChannels()

  return (
    <HumanChatShell channels={channels}>
      <div style={{ display: 'grid', placeItems: 'center', height: '60vh', color: 'var(--color-text-muted)' }}>
        <p>Create a channel to start chatting with your group.</p>
      </div>
    </HumanChatShell>
  )
}
