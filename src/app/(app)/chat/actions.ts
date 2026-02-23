'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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

  const { error } = await supabase
    .from('chat_threads')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('Error updating thread:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/chat')
  return { success: true }
}

/** Delete a thread and its messages */
export async function deleteThread(id: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('chat_threads')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting thread:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/chat')
  return { success: true }
}
