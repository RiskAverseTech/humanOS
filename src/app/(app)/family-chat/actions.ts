'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type FamilyChannelRow = {
  id: string
  owner_id: string
  name: string
  created_at: string
  updated_at: string
}

export type FamilyMessageRow = {
  id: string
  channel_id: string
  author_id: string
  content: string | null
  image_storage_path: string | null
  image_mime_type: string | null
  created_at: string
}

export async function getFamilyChannels(): Promise<FamilyChannelRow[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('family_chat_channels')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Error fetching family channels:', error)
    return []
  }

  return (data ?? []) as FamilyChannelRow[]
}

export async function getFamilyChannel(id: string): Promise<FamilyChannelRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('family_chat_channels')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as FamilyChannelRow
}

export async function getFamilyMessages(channelId: string, limit = 200): Promise<FamilyMessageRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('family_chat_messages')
    .select('*')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: true })
    .limit(limit)

  if (error) {
    console.error('Error fetching family messages:', error)
    return []
  }

  return (data ?? []) as FamilyMessageRow[]
}

export async function createFamilyChannel(input?: { name?: string }): Promise<string | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('family_chat_channels')
    .insert({
      owner_id: user.id,
      name: input?.name?.trim() || 'general',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating family channel:', error)
    return null
  }

  revalidatePath('/family-chat')
  return data.id
}

export async function renameFamilyChannel(channelId: string, name: string) {
  const supabase = await createClient()
  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'Name is required' }

  const { error } = await supabase
    .from('family_chat_channels')
    .update({ name: trimmed })
    .eq('id', channelId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/family-chat')
  revalidatePath(`/family-chat/${channelId}`)
  return { success: true }
}

export async function postFamilyMessage(input: {
  channelId: string
  content?: string | null
  imageStoragePath?: string | null
  imageMimeType?: string | null
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const content = input.content?.trim() || null
  if (!content && !input.imageStoragePath) {
    return { success: false, error: 'Message is empty' }
  }

  const { error } = await supabase.from('family_chat_messages').insert({
    channel_id: input.channelId,
    author_id: user.id,
    content,
    image_storage_path: input.imageStoragePath ?? null,
    image_mime_type: input.imageMimeType ?? null,
  })

  if (error) return { success: false, error: error.message }

  await supabase
    .from('family_chat_channels')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.channelId)

  revalidatePath('/family-chat')
  revalidatePath(`/family-chat/${input.channelId}`)
  return { success: true }
}

export async function deleteFamilyMessage(messageId: string) {
  const supabase = await createClient()
  const { data: msg } = await supabase
    .from('family_chat_messages')
    .select('channel_id, image_storage_path')
    .eq('id', messageId)
    .single()

  const { error } = await supabase
    .from('family_chat_messages')
    .delete()
    .eq('id', messageId)

  if (error) return { success: false, error: error.message }

  if (msg?.image_storage_path) {
    await supabase.storage.from('chat-uploads').remove([msg.image_storage_path])
  }

  revalidatePath('/family-chat')
  if (msg?.channel_id) revalidatePath(`/family-chat/${msg.channel_id}`)
  return { success: true }
}

export async function getFamilyChatUploadUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from('chat-uploads')
    .createSignedUrl(storagePath, 3600)

  if (error) {
    console.error('Family chat upload URL error:', error)
    return null
  }
  return data.signedUrl
}
