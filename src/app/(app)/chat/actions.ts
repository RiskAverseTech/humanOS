'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logActivityEvent } from '@/lib/activity/events'

export type ThreadRow = {
  id: string
  owner_id: string
  is_shared: boolean
  is_generating: boolean
  generation_started_at: string | null
  title: string
  model: string
  created_at: string
}

export type MessageRow = {
  id: string
  thread_id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  sender_id: string | null
  reply_to_message_id: string | null
  created_at: string
}

export type MessageReactionRow = {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

/** Fetch all chat threads the user can see */
export async function getThreads() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('chat_threads')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching threads:', error)
    return []
  }

  return (data ?? []) as ThreadRow[]
}

/** Get a single thread */
export async function getThread(id: string): Promise<ThreadRow | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('chat_threads')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as ThreadRow
}

/** Get messages for a thread */
export async function getMessages(threadId: string): Promise<MessageRow[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching messages:', error)
    return []
  }

  return (data ?? []) as MessageRow[]
}

export async function getChatMessageReactions(messageIds: string[]): Promise<MessageReactionRow[]> {
  const ids = Array.from(new Set(messageIds.filter(Boolean)))
  if (ids.length === 0) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('chat_message_reactions')
    .select('*')
    .in('message_id', ids)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching chat message reactions:', error)
    return []
  }

  return (data ?? []) as MessageReactionRow[]
}

/** Create a new thread */
export async function createThread(input?: {
  title?: string
  model?: string
  is_shared?: boolean
}): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('chat_threads')
    .insert({
      owner_id: user.id,
      title: input?.title ?? 'New Chat',
      model: input?.model ?? 'claude-sonnet-4-20250514',
      is_shared: input?.is_shared ?? true,
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating thread:', error)
    return null
  }

  revalidatePath('/chat')
  void logActivityEvent({
    actorUserId: user.id,
    category: 'ai_chat',
    entityType: 'ai_chat_thread',
    entityId: data!.id,
    action: 'created',
    title: input?.title ?? 'New Chat',
    href: `/chat/${data!.id}`,
  })
  return data!.id
}

/** Update a thread (title, model, shared) */
export async function updateThread(
  id: string,
  updates: {
    title?: string
    model?: string
    is_shared?: boolean
  }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('chat_threads')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('Error updating thread:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/chat')
  if (user) {
    void logActivityEvent({
      actorUserId: user.id,
      category: 'ai_chat',
      entityType: 'ai_chat_thread',
      entityId: id,
      action: 'updated',
      title: updates.title ?? (updates.is_shared !== undefined ? 'AI chat visibility updated' : 'AI chat updated'),
      href: `/chat/${id}`,
    })
  }
  return { success: true }
}

/** Delete a thread and its messages */
export async function deleteThread(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: thread } = await supabase.from('chat_threads').select('title').eq('id', id).maybeSingle()

  const { error } = await supabase
    .from('chat_threads')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting thread:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/chat')
  if (user) {
    void logActivityEvent({
      actorUserId: user.id,
      category: 'ai_chat',
      entityType: 'ai_chat_thread',
      entityId: id,
      action: 'deleted',
      title: thread?.title || 'Deleted AI chat',
      href: '/chat',
    })
  }
  return { success: true }
}

export async function toggleChatMessageReaction(input: {
  threadId: string
  messageId: string
  emoji: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const emoji = input.emoji.trim()
  if (!emoji) return { success: false, error: 'Emoji is required' }

  const { data: existing, error: existingError } = await supabase
    .from('chat_message_reactions')
    .select('id')
    .eq('message_id', input.messageId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existingError) return { success: false, error: existingError.message }

  if (existing) {
    const { error } = await supabase
      .from('chat_message_reactions')
      .delete()
      .eq('id', existing.id)
      .eq('user_id', user.id)
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase
      .from('chat_message_reactions')
      .insert({
        message_id: input.messageId,
        user_id: user.id,
        emoji,
      })
    if (error) return { success: false, error: error.message }
  }

  revalidatePath(`/chat/${input.threadId}`)
  return { success: true }
}
