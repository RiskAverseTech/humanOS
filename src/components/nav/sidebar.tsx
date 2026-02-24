'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useProfile } from '@/components/providers/profile-provider'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import { hasPermission } from '@/lib/rbac/roles'
import styles from './sidebar.module.css'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', icon: '🏠' },
  { href: '/notes', label: 'Notes', icon: '📝' },
  { href: '/vault', label: 'Vault', icon: '📁' },
  { href: '/todos', label: 'To Dos', icon: '📌' },
  { href: '/family-chat', label: 'Human Chat', icon: '🗨️' },
  { href: '/chat', label: 'AI Chat', icon: '💬' },
  { href: '/images', label: 'Images', icon: '🎨', permission: 'canGenerateImages' as const },
]

export function Sidebar() {
  const pathname = usePathname()
  const profile = useProfile()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null)

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  // Close on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false)
    }
    if (mobileOpen) {
      document.addEventListener('keydown', onKeyDown)
      return () => document.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileOpen])

  useEffect(() => {
    let cancelled = false

    async function loadAvatar() {
      if (!profile.avatarUrl) {
        setAvatarSrc(null)
        return
      }

      if (/^https?:\/\//i.test(profile.avatarUrl)) {
        setAvatarSrc(profile.avatarUrl)
        return
      }

      const supabase = createBrowserSupabaseClient()
      const { data, error } = await supabase.storage
        .from('avatars')
        .createSignedUrl(profile.avatarUrl, 3600)

      if (cancelled) return
      if (error) {
        setAvatarSrc(null)
        return
      }

      setAvatarSrc(data.signedUrl)
    }

    void loadAvatar()
    return () => {
      cancelled = true
    }
  }, [profile.avatarUrl])

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.permission) {
      return hasPermission(profile.role, item.permission)
    }
    return true
  })

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        className={styles.hamburger}
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation"
      >
        <span className={styles.hamburgerBar} />
        <span className={styles.hamburgerBar} />
        <span className={styles.hamburgerBar} />
      </button>

      {/* Overlay for mobile */}
      {mobileOpen && (
        <div className={styles.overlay} onClick={() => setMobileOpen(false)} />
      )}

      <aside className={`${styles.sidebar} ${mobileOpen ? styles.sidebarOpen : ''}`}>
        <div className={styles.header}>
          <Link href="/dashboard" className={styles.brand}>
            FamilyOS
          </Link>
          <div className={styles.headerActions}>
            <NotificationBell />
            <button
              className={styles.closeBtn}
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation"
            >
              &times;
            </button>
          </div>
        </div>

        <nav className={styles.nav}>
          {visibleItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
              >
                <span className={styles.navIcon}>{item.icon}</span>
                <span className={styles.navLabel}>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className={styles.footer}>
          <div className={styles.profile}>
            <div className={styles.avatar}>
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="" className={styles.avatarImage} />
              ) : (
                profile.displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div className={styles.profileInfo}>
              <span className={styles.profileName}>{profile.displayName}</span>
              <span className={styles.profileRole}>{profile.role}</span>
            </div>
          </div>
          <Link
            href="/settings"
            className={`${styles.footerLink} ${pathname.startsWith('/settings') ? styles.footerLinkActive : ''}`}
          >
            <span className={styles.footerLinkIcon}>⚙️</span>
            <span>Settings</span>
          </Link>
          <SignOutButton />
        </div>
      </aside>
    </>
  )
}

type NotificationApiItem = {
  type: 'note' | 'document' | 'chat' | 'image' | 'human_chat' | 'todo'
  category: 'notes' | 'vault' | 'todos' | 'human_chat' | 'ai_chat' | 'images'
  title: string
  href: string
  date: string
  icon: string
  ownerName?: string
  unread: boolean
}

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [enabled, setEnabled] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [items, setItems] = useState<NotificationApiItem[]>([])

  async function loadNotifications() {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json() as {
        enabled: boolean
        unreadCount: number
        items: NotificationApiItem[]
      }
      setEnabled(data.enabled)
      setUnreadCount(data.unreadCount)
      setItems(data.items ?? [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadNotifications()
    const interval = window.setInterval(() => {
      void loadNotifications()
    }, 15000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!open || unreadCount === 0) return
    void fetch('/api/notifications', { method: 'POST' })
      .then(() => {
        setUnreadCount(0)
        setItems((prev) => prev.map((item) => ({ ...item, unread: false })))
      })
      .catch(() => {})
  }, [open, unreadCount])

  return (
    <div className={styles.notifyWrap}>
      <button
        type="button"
        className={styles.notifyBtn}
        aria-label={unreadCount > 0 ? `${unreadCount} unread notifications` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.notifyIcon}>{enabled ? '🔔' : '🔕'}</span>
        {enabled && unreadCount > 0 && (
          <span className={styles.notifyBadge}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <>
          <button type="button" className={styles.notifyBackdrop} onClick={() => setOpen(false)} aria-label="Close notifications" />
          <div className={styles.notifyPanel}>
            <div className={styles.notifyPanelHeader}>
              <span className={styles.notifyPanelTitle}>Notifications</span>
              <Link href="/settings" className={styles.notifySettingsLink} onClick={() => setOpen(false)}>
                Settings
              </Link>
            </div>

            {!enabled ? (
              <p className={styles.notifyEmpty}>Notifications are turned off in Settings.</p>
            ) : loading ? (
              <p className={styles.notifyEmpty}>Loading...</p>
            ) : items.length === 0 ? (
              <p className={styles.notifyEmpty}>No recent updates.</p>
            ) : (
              <div className={styles.notifyList}>
                {items.map((item, index) => (
                  <Link
                    key={`${item.type}-${item.date}-${index}`}
                    href={item.href}
                    className={`${styles.notifyItem} ${item.unread ? styles.notifyItemUnread : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    <span className={styles.notifyItemIcon}>{item.icon}</span>
                    <div className={styles.notifyItemText}>
                      <span className={styles.notifyItemTitle}>{item.title}</span>
                      <span className={styles.notifyItemMeta}>
                        {item.ownerName ? `By ${item.ownerName} • ` : ''}
                        {new Date(item.date).toLocaleDateString('en-AU', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function SignOutButton() {
  async function handleSignOut() {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <button className={styles.signOut} onClick={handleSignOut}>
      Sign out
    </button>
  )
}
