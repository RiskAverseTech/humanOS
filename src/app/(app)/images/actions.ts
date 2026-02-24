'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { logActivityEvent } from '@/lib/activity/events'

export type GeneratedImageRow = {
  id: string
  owner_id: string
  prompt: string
  storage_path: string
  model: string
  created_at: string
}

/** Fetch all generated images (gallery view — all members can see) */
export async function getGeneratedImages(): Promise<GeneratedImageRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('generated_images')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching images:', error)
    return []
  }

  return (data ?? []) as GeneratedImageRow[]
}

/** Get a signed URL for a generated image */
export async function getImageUrl(storagePath: string): Promise<string | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.storage
    .from('generated-images')
    .createSignedUrl(storagePath, 3600)

  if (error) {
    console.error('Error creating signed URL:', error)
    return null
  }

  return data.signedUrl
}

/** Delete a generated image */
export async function deleteGeneratedImage(id: string, storagePath: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }
  const { data: existing } = await supabase
    .from('generated_images')
    .select('owner_id, prompt')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return { success: false, error: 'Image not found' }
  if (existing.owner_id !== user.id) {
    return { success: false, error: 'Only the creator can delete this image' }
  }

  await supabase.storage.from('generated-images').remove([storagePath])

  const { error } = await supabase
    .from('generated_images')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error deleting image:', error)
    return { success: false, error: error.message }
  }

  revalidatePath('/images')
  if (user) {
    void logActivityEvent({
      actorUserId: user.id,
      category: 'images',
      entityType: 'image',
      entityId: id,
      action: 'deleted',
      title: existing?.prompt || 'Deleted image',
      href: '/images',
    })
  }
  return { success: true }
}
