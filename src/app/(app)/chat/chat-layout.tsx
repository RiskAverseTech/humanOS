'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/components/providers/profile-provider'
import { ThreadList } from '@/components/chat/thread-list'
import { getAvailableModels, getDefaultModelId } from '@/lib/ai/prompts'
import { createThread, type ThreadRow } from './actions'
import styles from './chat-layout.module.css'

type ChatLayoutProps = {
  threads: ThreadRow[]
  threadOwnerNames: Record<string, string>
  rightSidebar?: React.ReactNode
  children: React.ReactNode
}

export function ChatLayout({ threads, threadOwnerNames, rightSidebar, children }: ChatLayoutProps) {
  const router = useRouter()
  const profile = useProfile()
  const models = getAvailableModels(profile.role)
  const [selectedModel, setSelectedModel] = useState(getDefaultModelId())

  async function handleNewChat() {
    const threadId = await createThread({
      model: selectedModel,
    })
    if (threadId) {
      router.push(`/chat/${threadId}`)
    }
  }

  return (
    <div className={`${styles.container} ${rightSidebar ? styles.containerWithRight : ''}`} data-full-width="human-chat">
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>Chats</h2>
          <button className={styles.newButton} onClick={handleNewChat}>
            + New
          </button>
        </div>

        {/* Model selector */}
        {models.length > 1 && (
          <div className={styles.modelPicker}>
            <label className={styles.modelLabel}>New chat model:</label>
            <select
              className={styles.modelSelect}
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <ThreadList threads={threads} ownerNames={threadOwnerNames} />
      </aside>

      <div className={styles.main}>
        {children}
      </div>
      {rightSidebar && <aside className={styles.rightSidebar}>{rightSidebar}</aside>}
    </div>
  )
}
