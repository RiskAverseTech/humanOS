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
  const [mobilePanel, setMobilePanel] = useState<'threads' | 'members' | null>(null)

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
      <div className={styles.mobileTopBar}>
        <button type="button" className={styles.mobileTopBtn} onClick={() => setMobilePanel('threads')}>
          Chats
        </button>
        {rightSidebar && (
          <button type="button" className={styles.mobileTopBtn} onClick={() => setMobilePanel('members')}>
            Members
          </button>
        )}
      </div>

      {mobilePanel && (
        <>
          <button
            type="button"
            className={styles.mobilePanelBackdrop}
            onClick={() => setMobilePanel(null)}
            aria-label="Close panel"
          />
          <aside className={styles.mobilePanel}>
            <div className={styles.mobilePanelHeader}>
              <strong>{mobilePanel === 'threads' ? 'AI Chats' : 'In This Chat'}</strong>
              <button type="button" className={styles.mobilePanelClose} onClick={() => setMobilePanel(null)}>
                &times;
              </button>
            </div>
            <div className={styles.mobilePanelBody}>
              {mobilePanel === 'threads' ? (
                <>
                  <div className={styles.sidebarHeader}>
                    <h2 className={styles.sidebarTitle}>Chats</h2>
                    <button className={styles.newButton} onClick={handleNewChat}>
                      + New
                    </button>
                  </div>
                  {models.length > 1 && (
                    <div className={styles.modelPicker}>
                      <label className={styles.modelLabel}>New chat model:</label>
                      <select
                        className={styles.modelSelect}
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                      >
                        {models.map((m) => (
                          <option key={`mobile-${m.id}`} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div onClick={() => setMobilePanel(null)}>
                    <ThreadList threads={threads} ownerNames={threadOwnerNames} />
                  </div>
                </>
              ) : (
                rightSidebar
              )}
            </div>
          </aside>
        </>
      )}

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
