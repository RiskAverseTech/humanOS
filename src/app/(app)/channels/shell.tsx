'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createFamilyChannel, type FamilyChannelRow } from './actions'
import styles from './shell.module.css'

export function HumanChatShell({
  channels,
  rightSidebar,
  children,
}: {
  channels: FamilyChannelRow[]
  rightSidebar?: React.ReactNode
  children: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [creating, setCreating] = useState(false)
  const [mobilePanel, setMobilePanel] = useState<'channels' | 'members' | null>(null)

  async function handleCreate() {
    setCreating(true)
    const id = await createFamilyChannel({ name: channels.length === 0 ? 'general' : 'new-channel' })
    setCreating(false)
    if (id) router.push(`/channels/${id}`)
  }

  return (
    <div
      className={`${styles.container} ${rightSidebar ? styles.containerWithRight : ''}`}
      data-full-width="human-chat"
    >
      <div className={styles.mobileTopBar}>
        <button type="button" className={styles.mobileTopBtn} onClick={() => setMobilePanel('channels')}>
          # Channels
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
            aria-label="Close panel"
            onClick={() => setMobilePanel(null)}
          />
          <aside className={styles.mobilePanel}>
            <div className={styles.mobilePanelHeader}>
              <strong>{mobilePanel === 'channels' ? 'Human Chat Channels' : 'In This Chat'}</strong>
              <button type="button" className={styles.mobilePanelClose} onClick={() => setMobilePanel(null)}>
                &times;
              </button>
            </div>
            {mobilePanel === 'channels' ? (
              <div className={styles.mobilePanelBody}>
                <div className={styles.sidebarHeader}>
                  <div>
                    <h2 className={styles.sidebarTitle}>Human Chat</h2>
                    <p className={styles.sidebarSubtitle}>Channels</p>
                  </div>
                  <button className={styles.newButton} onClick={handleCreate} disabled={creating}>
                    {creating ? '...' : '+'}
                  </button>
                </div>
                <div className={styles.channelList}>
                  {channels.map((channel) => {
                    const href = `/channels/${channel.id}`
                    const active = pathname === href
                    return (
                      <Link
                        key={`mobile-${channel.id}`}
                        href={href}
                        className={`${styles.channelItem} ${active ? styles.active : ''}`}
                        onClick={() => setMobilePanel(null)}
                      >
                        <span className={styles.hash}>#</span>
                        <span className={styles.channelName}>{channel.name}</span>
                      </Link>
                    )
                  })}
                  {channels.length === 0 && <p className={styles.empty}>No channels yet</p>}
                </div>
              </div>
            ) : (
              <div className={styles.mobilePanelBody}>{rightSidebar}</div>
            )}
          </aside>
        </>
      )}

      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div>
            <h2 className={styles.sidebarTitle}>Human Chat</h2>
            <p className={styles.sidebarSubtitle}>Channels</p>
          </div>
          <button className={styles.newButton} onClick={handleCreate} disabled={creating}>
            {creating ? '...' : '+'}
          </button>
        </div>

        <div className={styles.channelList}>
          {channels.map((channel) => {
            const href = `/channels/${channel.id}`
            const active = pathname === href
            return (
              <Link key={channel.id} href={href} className={`${styles.channelItem} ${active ? styles.active : ''}`}>
                <span className={styles.hash}>#</span>
                <span className={styles.channelName}>{channel.name}</span>
              </Link>
            )
          })}
          {channels.length === 0 && <p className={styles.empty}>No channels yet</p>}
        </div>
      </aside>

      <div className={styles.main}>{children}</div>
      {rightSidebar && <aside className={styles.rightSidebar}>{rightSidebar}</aside>}
    </div>
  )
}
