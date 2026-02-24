import { createClient } from '@/lib/supabase/server'
import type { NotificationCategory } from '@/lib/supabase/types'
import { getProfileNamesByUserIds } from '@/lib/supabase/profile'
import { getActivityFeed } from '@/lib/activity/feed'

export type ActivityEventEntity =
  | 'note'
  | 'document'
  | 'todo_card'
  | 'todo_item'
  | 'human_chat_channel'
  | 'human_chat_message'
  | 'ai_chat_thread'
  | 'ai_chat_message'
  | 'image'

export type ActivityEventAction = 'created' | 'updated' | 'deleted' | 'message_posted'

export type ActivityEventInput = {
  actorUserId?: string
  category: NotificationCategory
  entityType: ActivityEventEntity
  entityId: string
  action: ActivityEventAction
  title: string
  href: string
}

export type NotificationEventItem = {
  id: string
  category: NotificationCategory
  type: 'note' | 'document' | 'chat' | 'image' | 'human_chat' | 'todo'
  title: string
  href: string
  date: string
  icon: string
  ownerName?: string
  ownerId?: string
}

const CATEGORY_ICON: Record<NotificationCategory, string> = {
  notes: '📝',
  vault: '📁',
  todos: '📌',
  human_chat: '🗨️',
  ai_chat: '💬',
  images: '🎨',
}

const CATEGORY_TYPE: Record<NotificationCategory, NotificationEventItem['type']> = {
  notes: 'note',
  vault: 'document',
  todos: 'todo',
  human_chat: 'human_chat',
  ai_chat: 'chat',
  images: 'image',
}

export async function logActivityEvent(event: ActivityEventInput): Promise<void> {
  try {
    const supabase = await createClient()
    let actorUserId = event.actorUserId

    if (!actorUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      actorUserId = user?.id
    }

    if (!actorUserId) return

    await supabase.from('activity_events').insert({
      actor_user_id: actorUserId,
      category: event.category,
      entity_type: event.entityType,
      entity_id: event.entityId,
      action: event.action,
      title: event.title,
      href: event.href,
    })
  } catch (error) {
    console.error('Failed to log activity event:', error)
  }
}

export async function getNotificationEvents(options?: {
  categories?: NotificationCategory[]
  limit?: number
}): Promise<NotificationEventItem[]> {
  const supabase = await createClient()
  let query = supabase
    .from('activity_events')
    .select('id, actor_user_id, category, title, href, created_at')
    .order('created_at', { ascending: false })
    .limit(options?.limit ?? 30)

  if (options?.categories?.length) {
    query = query.in('category', options.categories)
  }

  const { data, error } = await query
  if (error || !data) {
    if (error) {
      console.error('Failed to fetch notification events:', error)
      if (
        error.code === 'PGRST205' ||
        (typeof error.message === 'string' && error.message.includes('activity_events'))
      ) {
        const fallback = await getActivityFeed({ maxItems: options?.limit ?? 30 })
        const categoryMap: Record<NotificationEventItem['type'], NotificationCategory> = {
          note: 'notes',
          document: 'vault',
          todo: 'todos',
          human_chat: 'human_chat',
          chat: 'ai_chat',
          image: 'images',
        }
        return fallback
          .filter((item) => !options?.categories?.length || options.categories.includes(categoryMap[item.type]))
          .map((item, index) => ({
            id: `fallback-${item.type}-${item.date}-${index}`,
            category: categoryMap[item.type],
            type: item.type,
            title: item.title,
            href: item.href,
            date: item.date,
            icon: item.icon,
            ownerId: item.ownerId,
            ownerName: item.ownerName,
          }))
      }
    }
    return []
  }

  const actorNames = await getProfileNamesByUserIds(data.map((row) => row.actor_user_id))

  return data.map((row) => {
    const category = row.category as NotificationCategory
    return {
      id: row.id,
      category,
      type: CATEGORY_TYPE[category],
      title: row.title,
      href: row.href,
      date: row.created_at,
      icon: CATEGORY_ICON[category],
      ownerId: row.actor_user_id,
      ownerName: actorNames[row.actor_user_id],
    }
  })
}
