'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logActivityEvent } from '@/lib/activity/events'

export type DocumentRow = {
  id: string
  owner_id: string
  file_name: string
  storage_path: string
  mime_type: string
  is_shared: boolean
  tags: string[]
  folder_path: string | null
  size: number
  created_at: string
}

/** Fetch all documents the current user can see (own + shared) */
export async function getDocuments(options?: {
  folder?: string | null
  tag?: string | null
  search?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false })

  if (options?.folder) {
    query = query.eq('folder_path', options.folder)
  }

  if (options?.tag) {
    query = query.contains('tags', [options.tag])
  }

  if (options?.search) {
    query = query.ilike('file_name', `%${options.search}%`)
  }

  const { data, error } = await query
  if (error) {
    console.error('Error fetching documents:', error)
    return []
  }

  return (data ?? []) as DocumentRow[]
}

/** Get a single document by ID */
export async function getDocument(id: string): Promise<DocumentRow | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as DocumentRow
}

/** Create a document record after upload */
export async function createDocumentRecord(input: {
  file_name: string
  storage_path: string
  mime_type: string
  size: number
  folder_path?: string | null
  is_shared?: boolean
  tags?: string[]
}): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('documents')
    .insert({
      owner_id: user.id,
      file_name: input.file_name,
      storage_path: input.storage_path,
      mime_type: input.mime_type,
      size: input.size,
      folder_path: input.folder_path ?? null,
      is_shared: input.is_shared ?? true,
      tags: input.tags ?? [],
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating document record:', error)
    return null
  }

  revalidatePath('/vault')
  void logActivityEvent({
    actorUserId: user.id,
    category: 'vault',
    entityType: 'document',
    entityId: data!.id,
    action: 'created',
    title: input.file_name,
    href: '/vault',
  })
  return data!.id
}

/** Update a document's metadata */
export async function updateDocument(
  id: string,
  updates: {
    file_name?: string
    folder_path?: string | null
    is_shared?: boolean
    tags?: string[]
  }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('documents')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('Error updating document:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/vault')
  if (user) {
    void logActivityEvent({
      actorUserId: user.id,
      category: 'vault',
      entityType: 'document',
      entityId: id,
      action: 'updated',
      title: updates.file_name ?? 'Document updated',
      href: '/vault',
    })
  }
  return { success: true }
}

/** Delete a document and its storage object */
export async function deleteDocument(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get the storage path first
  const { data: doc } = await supabase
    .from('documents')
    .select('storage_path, file_name')
    .eq('id', id)
    .single()

  if (doc) {
    await supabase.storage.from('documents').remove([doc.storage_path])
  }

  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting document:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/vault')
  if (user) {
    void logActivityEvent({
      actorUserId: user.id,
      category: 'vault',
      entityType: 'document',
      entityId: id,
      action: 'deleted',
      title: doc?.file_name || 'Deleted document',
      href: '/vault',
    })
  }
  return { success: true }
}

/** Get a signed URL for downloading/previewing a document.
 *  Uses the admin client so shared documents from other users can be previewed. */
export async function getDocumentUrl(storagePath: string): Promise<string | null> {
  // Ensure the caller is authenticated before generating a URL
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Use admin client to bypass per-user storage policies for shared docs
  const admin = createAdminClient()
  const { data, error } = await admin.storage
    .from('documents')
    .createSignedUrl(storagePath, 3600) // 1 hour expiry

  if (error) {
    console.error('Error creating signed URL:', error)
    return null
  }

  return data.signedUrl
}

/** Get all unique folders */
export async function getDocumentFolders(): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('documents')
    .select('folder_path')
    .not('folder_path', 'is', null)

  if (!data) return []

  const folders = Array.from(new Set(data.map((d) => d.folder_path).filter(Boolean))) as string[]
  return folders.sort()
}

/** Get all unique tags */
export async function getDocumentTags(): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('documents')
    .select('tags')

  if (!data) return []

  const allTags = data.flatMap((d) => d.tags ?? [])
  return Array.from(new Set(allTags)).sort()
}
