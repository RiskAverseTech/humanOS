'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logActivityEvent } from '@/lib/activity/events'

export type NoteRow = {
  id: string
  owner_id: string
  title: string
  content: string | null
  is_shared: boolean
  tags: string[]
  folder_path: string | null
  created_at: string
  updated_at: string
}

/** Fetch all notes the current user can see (own + shared) */
export async function getNotes(options?: {
  folder?: string | null
  tag?: string | null
  search?: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let query = supabase
    .from('notes')
    .select('id, owner_id, title, content, is_shared, tags, folder_path, created_at, updated_at')
    .order('updated_at', { ascending: false })

  if (options?.folder) {
    query = query.eq('folder_path', options.folder)
  }

  if (options?.tag) {
    query = query.contains('tags', [options.tag])
  }

  if (options?.search) {
    query = query.textSearch('search_vector', options.search, {
      type: 'websearch',
    })
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching notes:', error)
    return []
  }

  return (data ?? []) as NoteRow[]
}

/** Get a single note by ID */
export async function getNote(id: string): Promise<NoteRow | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('notes')
    .select('id, owner_id, title, content, is_shared, tags, folder_path, created_at, updated_at')
    .eq('id', id)
    .single()

  if (error) return null
  return data as NoteRow
}

/** Create a new note, return its ID */
export async function createNote(input: {
  title?: string
  content?: string
  folder_path?: string | null
  is_shared?: boolean
  tags?: string[]
}): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('notes')
    .insert({
      owner_id: user.id,
      title: input.title ?? 'Untitled',
      content: input.content ?? '',
      folder_path: input.folder_path ?? null,
      is_shared: input.is_shared ?? true,
      tags: input.tags ?? [],
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error creating note:', error)
    return null
  }

  revalidatePath('/notes')
  void logActivityEvent({
    actorUserId: user.id,
    category: 'notes',
    entityType: 'note',
    entityId: data!.id,
    action: 'created',
    title: input.title ?? 'Untitled',
    href: `/notes/${data!.id}`,
  })
  return data!.id
}

/** Update an existing note */
export async function updateNote(
  id: string,
  updates: {
    title?: string
    content?: string
    folder_path?: string | null
    is_shared?: boolean
    tags?: string[]
  },
  options?: {
    logEvent?: boolean
  }
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase
    .from('notes')
    .update(updates)
    .eq('id', id)

  if (error) {
    console.error('Error updating note:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/notes')
  revalidatePath(`/notes/${id}`)
  if (user && options?.logEvent !== false) {
    void logActivityEvent({
      actorUserId: user.id,
      category: 'notes',
      entityType: 'note',
      entityId: id,
      action: 'updated',
      title: updates.title ?? 'Note updated',
      href: `/notes/${id}`,
    })
  }
  return { success: true }
}

/** Delete a note */
export async function deleteNote(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  const { data: existing } = await supabase.from('notes').select('title').eq('id', id).maybeSingle()

  const { data: noteOwner } = await supabase
    .from('notes')
    .select('owner_id')
    .eq('id', id)
    .maybeSingle()

  if (!noteOwner) {
    return { success: false, error: 'Note not found' }
  }

  if (noteOwner.owner_id !== user.id) {
    return { success: false, error: 'Only the note owner can delete this note' }
  }

  const { error } = await supabase
    .from('notes')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting note:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/notes')
  if (user) {
    void logActivityEvent({
      actorUserId: user.id,
      category: 'notes',
      entityType: 'note',
      entityId: id,
      action: 'deleted',
      title: existing?.title || 'Deleted note',
      href: '/notes',
    })
  }
  return { success: true }
}

/** Rename a virtual folder by moving all notes with that folder_path */
export async function renameNoteFolder(oldFolder: string, newFolder: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  const trimmedOld = oldFolder.trim()
  const trimmedNew = newFolder.trim()
  if (!trimmedOld) return { success: false, error: 'Source folder is required' }
  if (!trimmedNew) return { success: false, error: 'New folder name is required' }

  const { error } = await supabase
    .from('notes')
    .update({ folder_path: trimmedNew })
    .eq('owner_id', user.id)
    .eq('folder_path', trimmedOld)

  if (error) {
    console.error('Error renaming note folder:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/notes')
  return { success: true }
}

/** Delete a virtual folder by clearing folder_path from notes in that folder */
export async function deleteNoteFolder(folder: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  const trimmed = folder.trim()
  if (!trimmed) return { success: false, error: 'Folder is required' }

  const { error } = await supabase
    .from('notes')
    .update({ folder_path: null })
    .eq('owner_id', user.id)
    .eq('folder_path', trimmed)

  if (error) {
    console.error('Error deleting note folder:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/notes')
  return { success: true }
}

/** Get all unique folders for the current user's notes */
export async function getNoteFolders(): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('notes')
    .select('folder_path')
    .eq('owner_id', user.id)
    .not('folder_path', 'is', null)

  if (!data) return []

  const folders = Array.from(new Set(data.map((n) => n.folder_path).filter(Boolean))) as string[]
  return folders.sort()
}

/** Get all unique tags across the user's notes */
export async function getNoteTags(): Promise<string[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('notes')
    .select('tags')
    .eq('owner_id', user.id)

  if (!data) return []

  const allTags = data.flatMap((n) => n.tags ?? [])
  return Array.from(new Set(allTags)).sort()
}
