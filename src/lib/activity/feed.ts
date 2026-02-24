import { createClient } from '@/lib/supabase/server'
import { getProfileNamesByUserIds } from '@/lib/supabase/profile'

export type ActivityFeedType = 'note' | 'document' | 'chat' | 'image' | 'human_chat' | 'todo'

export type ActivityFeedItem = {
  type: ActivityFeedType
  title: string
  href: string
  date: string
  icon: string
  ownerId?: string
  ownerName?: string
}

export async function getActivityFeed(options?: {
  perSourceLimit?: number
  maxItems?: number
}): Promise<ActivityFeedItem[]> {
  const perSourceLimit = options?.perSourceLimit ?? 20
  const maxItems = options?.maxItems ?? 50
  const supabase = await createClient()

  const [
    { data: notes },
    { data: docs },
    { data: chats },
    { data: images },
    { data: humanChats },
    { data: todos },
  ] = await Promise.all([
    supabase.from('notes').select('id, title, updated_at, owner_id').order('updated_at', { ascending: false }).limit(perSourceLimit),
    supabase.from('documents').select('id, file_name, created_at, owner_id').order('created_at', { ascending: false }).limit(perSourceLimit),
    supabase.from('chat_threads').select('id, title, created_at, owner_id').order('created_at', { ascending: false }).limit(perSourceLimit),
    supabase.from('generated_images').select('id, prompt, created_at, owner_id').order('created_at', { ascending: false }).limit(perSourceLimit),
    supabase.from('human_chat_channels').select('id, name, updated_at, owner_id').order('updated_at', { ascending: false }).limit(perSourceLimit),
    supabase.from('todo_cards').select('id, title, updated_at, owner_id').order('updated_at', { ascending: false }).limit(perSourceLimit),
  ])

  const ownerNames = await getProfileNamesByUserIds([
    ...(notes ?? []).map((x) => x.owner_id),
    ...(docs ?? []).map((x) => x.owner_id),
    ...(chats ?? []).map((x) => x.owner_id),
    ...(images ?? []).map((x) => x.owner_id),
    ...(humanChats ?? []).map((x) => x.owner_id),
    ...(todos ?? []).map((x) => x.owner_id),
  ])

  const items: ActivityFeedItem[] = []
  for (const x of notes ?? []) items.push({ type: 'note', title: x.title || 'Untitled note', href: `/notes/${x.id}`, date: x.updated_at, icon: '📝', ownerId: x.owner_id, ownerName: ownerNames[x.owner_id] })
  for (const x of docs ?? []) items.push({ type: 'document', title: x.file_name, href: '/vault', date: x.created_at, icon: '📁', ownerId: x.owner_id, ownerName: ownerNames[x.owner_id] })
  for (const x of chats ?? []) items.push({ type: 'chat', title: x.title || 'New Chat', href: `/chat/${x.id}`, date: x.created_at, icon: '💬', ownerId: x.owner_id, ownerName: ownerNames[x.owner_id] })
  for (const x of images ?? []) items.push({ type: 'image', title: x.prompt.slice(0, 60) + (x.prompt.length > 60 ? '...' : ''), href: '/images', date: x.created_at, icon: '🎨', ownerId: x.owner_id, ownerName: ownerNames[x.owner_id] })
  for (const x of humanChats ?? []) items.push({ type: 'human_chat', title: x.name || 'Human Chat', href: `/channels/${x.id}`, date: x.updated_at, icon: '🗨️', ownerId: x.owner_id, ownerName: ownerNames[x.owner_id] })
  for (const x of todos ?? []) items.push({ type: 'todo', title: x.title || 'To Do List', href: '/todos', date: x.updated_at, icon: '📌', ownerId: x.owner_id, ownerName: ownerNames[x.owner_id] })

  items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  return items.slice(0, maxItems)
}
