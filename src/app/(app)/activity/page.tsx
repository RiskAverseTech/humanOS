import Link from 'next/link'
import { getProfileNamesByUserIds } from '@/lib/supabase/profile'
import { createClient } from '@/lib/supabase/server'
import styles from '../dashboard/dashboard.module.css'

type ActivityItem = {
  type: 'note' | 'document' | 'chat' | 'image' | 'human_chat' | 'todo'
  title: string
  href: string
  date: string
  icon: string
  ownerName?: string
}

export default async function ActivityPage() {
  const supabase = await createClient()

  const [
    { data: notes },
    { data: docs },
    { data: chats },
    { data: images },
    { data: humanChats },
    { data: todos },
  ] = await Promise.all([
    supabase.from('notes').select('id, title, updated_at, owner_id').order('updated_at', { ascending: false }).limit(50),
    supabase.from('documents').select('id, file_name, created_at, owner_id').order('created_at', { ascending: false }).limit(50),
    supabase.from('chat_threads').select('id, title, created_at, owner_id').order('created_at', { ascending: false }).limit(50),
    supabase.from('generated_images').select('id, prompt, created_at, owner_id').order('created_at', { ascending: false }).limit(50),
    supabase.from('family_chat_channels').select('id, name, updated_at, owner_id').order('updated_at', { ascending: false }).limit(50),
    supabase.from('todo_cards').select('id, title, updated_at, owner_id').order('updated_at', { ascending: false }).limit(50),
  ])

  const ownerNames = await getProfileNamesByUserIds([
    ...(notes ?? []).map((x) => x.owner_id),
    ...(docs ?? []).map((x) => x.owner_id),
    ...(chats ?? []).map((x) => x.owner_id),
    ...(images ?? []).map((x) => x.owner_id),
    ...(humanChats ?? []).map((x) => x.owner_id),
    ...(todos ?? []).map((x) => x.owner_id),
  ])

  const items: ActivityItem[] = []
  for (const x of notes ?? []) items.push({ type: 'note', title: x.title || 'Untitled note', href: `/notes/${x.id}`, date: x.updated_at, icon: '📝', ownerName: ownerNames[x.owner_id] })
  for (const x of docs ?? []) items.push({ type: 'document', title: x.file_name, href: '/vault', date: x.created_at, icon: '📁', ownerName: ownerNames[x.owner_id] })
  for (const x of chats ?? []) items.push({ type: 'chat', title: x.title || 'New Chat', href: `/chat/${x.id}`, date: x.created_at, icon: '💬', ownerName: ownerNames[x.owner_id] })
  for (const x of images ?? []) items.push({ type: 'image', title: x.prompt.slice(0, 60) + (x.prompt.length > 60 ? '...' : ''), href: '/images', date: x.created_at, icon: '🎨', ownerName: ownerNames[x.owner_id] })
  for (const x of humanChats ?? []) items.push({ type: 'human_chat', title: x.name || 'Human Chat', href: `/family-chat/${x.id}`, date: x.updated_at, icon: '🗨️', ownerName: ownerNames[x.owner_id] })
  for (const x of todos ?? []) items.push({ type: 'todo', title: x.title || 'To Do List', href: '/todos', date: x.updated_at, icon: '📌', ownerName: ownerNames[x.owner_id] })

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return (
    <div className={styles.container}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        <h1 className={styles.greeting} style={{ marginBottom: 0 }}>All Activity</h1>
        <Link href="/dashboard" style={{ color: 'var(--color-primary)', textDecoration: 'none', fontSize: 'var(--text-sm)' }}>
          Back to dashboard
        </Link>
      </div>

      {items.length === 0 ? (
        <p className={styles.emptyText}>No activity yet.</p>
      ) : (
        <div className={styles.activityList}>
          {items.map((item, i) => (
            <Link key={`${item.type}-${i}`} href={item.href} className={styles.activityItem}>
              <span className={styles.activityIcon}>{item.icon}</span>
              <div className={styles.activityText}>
                <span className={styles.activityTitle}>{item.title}</span>
                {item.ownerName && <span className={styles.activityOwner}>By {item.ownerName}</span>}
              </div>
              <span className={styles.activityDate}>
                {new Date(item.date).toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
