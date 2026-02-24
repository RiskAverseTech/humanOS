'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logActivityEvent } from '@/lib/activity/events'

export type FamilyChannelRow = {
  id: string
  owner_id: string
  name: string
  archived_at?: string | null
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
  reply_to_message_id: string | null
  created_at: string
}

export type FamilyMessageReactionRow = {
  id: string
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export type FamilyGeneratedImagePickerItem = {
  id: string
  prompt: string
  storage_path: string
  preview_url: string | null
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
    .is('archived_at', null)
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
    .is('archived_at', null)
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

export async function getFamilyMessageReactions(messageIds: string[]): Promise<FamilyMessageReactionRow[]> {
  const ids = Array.from(new Set(messageIds.filter(Boolean)))
  if (ids.length === 0) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('family_chat_message_reactions')
    .select('*')
    .in('message_id', ids)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('Error fetching family chat message reactions:', error)
    return []
  }

  return (data ?? []) as FamilyMessageReactionRow[]
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
  void logActivityEvent({
    actorUserId: user.id,
    category: 'human_chat',
    entityType: 'human_chat_channel',
    entityId: data.id,
    action: 'created',
    title: input?.name?.trim() || 'general',
    href: `/family-chat/${data.id}`,
  })
  return data.id
}

export async function renameFamilyChannel(channelId: string, name: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const trimmed = name.trim()
  if (!trimmed) return { success: false, error: 'Name is required' }

  const { error } = await supabase
    .from('family_chat_channels')
    .update({ name: trimmed })
    .eq('id', channelId)

  if (error) return { success: false, error: error.message }
  revalidatePath('/family-chat')
  revalidatePath(`/family-chat/${channelId}`)
  if (user) {
    void logActivityEvent({
      actorUserId: user.id,
      category: 'human_chat',
      entityType: 'human_chat_channel',
      entityId: channelId,
      action: 'updated',
      title: trimmed,
      href: `/family-chat/${channelId}`,
    })
  }
  return { success: true }
}

export async function archiveFamilyChannel(channelId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: channel, error: readError } = await supabase
    .from('family_chat_channels')
    .select('id, owner_id, name')
    .eq('id', channelId)
    .single()

  if (readError || !channel) {
    return { success: false, error: 'Channel not found' }
  }
  if (channel.owner_id !== user.id) {
    return { success: false, error: 'Only the channel owner can archive this chat' }
  }

  const { error } = await supabase
    .from('family_chat_channels')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', channelId)
    .eq('owner_id', user.id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/family-chat')
  revalidatePath(`/family-chat/${channelId}`)
  void logActivityEvent({
    actorUserId: user.id,
    category: 'human_chat',
    entityType: 'human_chat_channel',
    entityId: channelId,
    action: 'deleted',
    title: `Archived #${channel.name}`,
    href: '/family-chat',
  })

  return { success: true }
}

export async function postFamilyMessage(input: {
  channelId: string
  content?: string | null
  imageStoragePath?: string | null
  imageMimeType?: string | null
  replyToMessageId?: string | null
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
    reply_to_message_id: input.replyToMessageId ?? null,
  })

  if (error) return { success: false, error: error.message }

  await supabase
    .from('family_chat_channels')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.channelId)

  revalidatePath('/family-chat')
  revalidatePath(`/family-chat/${input.channelId}`)
  void logActivityEvent({
    actorUserId: user.id,
    category: 'human_chat',
    entityType: 'human_chat_message',
    entityId: input.channelId,
    action: 'message_posted',
    title: content ?? (input.imageStoragePath ? 'Shared an image' : 'Message'),
    href: `/family-chat/${input.channelId}`,
  })
  return { success: true }
}

export async function deleteFamilyMessage(messageId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
  if (user) {
    void logActivityEvent({
      actorUserId: user.id,
      category: 'human_chat',
      entityType: 'human_chat_message',
      entityId: messageId,
      action: 'deleted',
      title: 'Deleted message',
      href: msg?.channel_id ? `/family-chat/${msg.channel_id}` : '/family-chat',
    })
  }
  return { success: true }
}

export async function toggleFamilyMessageReaction(input: {
  channelId: string
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
    .from('family_chat_message_reactions')
    .select('id')
    .eq('message_id', input.messageId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
    .maybeSingle()

  if (existingError) return { success: false, error: existingError.message }

  if (existing) {
    const { error } = await supabase
      .from('family_chat_message_reactions')
      .delete()
      .eq('id', existing.id)
      .eq('user_id', user.id)
    if (error) return { success: false, error: error.message }
  } else {
    const { error } = await supabase
      .from('family_chat_message_reactions')
      .insert({
        message_id: input.messageId,
        user_id: user.id,
        emoji,
      })
    if (error) return { success: false, error: error.message }
  }

  revalidatePath(`/family-chat/${input.channelId}`)
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

export async function getGeneratedImagesForFamilyChatPicker(limit = 24): Promise<FamilyGeneratedImagePickerItem[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('generated_images')
    .select('id, prompt, storage_path, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error || !data) {
    console.error('Error fetching generated images for picker:', error)
    return []
  }

  const items: FamilyGeneratedImagePickerItem[] = []
  for (const row of data) {
    const { data: signed } = await supabase.storage
      .from('generated-images')
      .createSignedUrl(row.storage_path, 3600)

    items.push({
      id: row.id,
      prompt: row.prompt,
      storage_path: row.storage_path,
      created_at: row.created_at,
      preview_url: signed?.signedUrl ?? null,
    })
  }

  return items
}

export async function copyGeneratedImageToFamilyChatUpload(imageId: string): Promise<{
  success: boolean
  error?: string
  attachment?: {
    storagePath: string
    mimeType: string
    previewUrl: string
  }
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const { data: image, error: imageError } = await supabase
    .from('generated_images')
    .select('id, storage_path')
    .eq('id', imageId)
    .single()

  if (imageError || !image) {
    return { success: false, error: 'Image not found' }
  }

  const { data: blob, error: downloadError } = await supabase.storage
    .from('generated-images')
    .download(image.storage_path)

  if (downloadError || !blob) {
    return { success: false, error: downloadError?.message || 'Could not load generated image' }
  }

  const ext = image.storage_path.split('.').pop() || 'png'
  const storagePath = `${user.id}/${Date.now()}-gallery-${Math.random().toString(36).slice(2)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('chat-uploads')
    .upload(storagePath, blob, { cacheControl: '3600', upsert: false, contentType: blob.type || 'image/png' })

  if (uploadError) {
    return { success: false, error: uploadError.message }
  }

  const { data: signed, error: signedError } = await supabase.storage
    .from('chat-uploads')
    .createSignedUrl(storagePath, 3600)

  if (signedError || !signed?.signedUrl) {
    return { success: false, error: signedError?.message || 'Could not preview selected image' }
  }

  return {
    success: true,
    attachment: {
      storagePath,
      mimeType: blob.type || 'image/png',
      previewUrl: signed.signedUrl,
    },
  }
}
