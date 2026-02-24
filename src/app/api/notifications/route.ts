import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getNotificationEvents } from '@/lib/activity/events'
import type { NotificationCategory } from '@/lib/supabase/types'

type NotificationItem = Awaited<ReturnType<typeof getNotificationEvents>>[number] & {
  category: NotificationCategory
  unread: boolean
}

const DEFAULT_CATEGORIES: NotificationCategory[] = ['notes', 'vault', 'todos', 'human_chat', 'ai_chat', 'images']

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('notifications_enabled, notification_categories, notifications_last_seen_at')
    .eq('user_id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const enabled = profile.notifications_enabled ?? true
  const categories = ((profile.notification_categories as NotificationCategory[] | null) ?? DEFAULT_CATEGORIES)
  const lastSeen = profile.notifications_last_seen_at ?? new Date(0).toISOString()

  const rawItems = enabled ? await getNotificationEvents({ categories }) : []
  const filteredItems: NotificationItem[] = rawItems
    .filter((item) => item.ownerId !== user.id)
    .map((item) => {
      const unread = new Date(item.date).getTime() > new Date(lastSeen).getTime()
      return { ...item, unread }
    })

  const unreadCount = enabled ? filteredItems.filter((i) => i.unread).length : 0

  return NextResponse.json({
    enabled,
    categories,
    lastSeen,
    unreadCount,
    items: filteredItems,
  })
}

export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('profiles')
    .update({ notifications_last_seen_at: now })
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ success: true, seenAt: now })
}
