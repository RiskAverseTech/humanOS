'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type TodoCardRow = {
  id: string
  owner_id: string
  title: string
  is_shared: boolean
  color: string
  created_at: string
  updated_at: string
}

export type TodoItemRow = {
  id: string
  card_id: string
  text: string
  is_done: boolean
  position: number
  created_at: string
}

export async function getTodoCardsWithItems(): Promise<{
  cards: TodoCardRow[]
  itemsByCardId: Record<string, TodoItemRow[]>
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { cards: [], itemsByCardId: {} }

  const { data: cards, error: cardsError } = await supabase
    .from('todo_cards')
    .select('*')
    .order('updated_at', { ascending: false })

  if (cardsError || !cards) {
    console.error('Error fetching todo cards:', cardsError)
    return { cards: [], itemsByCardId: {} }
  }

  const cardIds = cards.map((c) => c.id)
  if (cardIds.length === 0) return { cards: cards as TodoCardRow[], itemsByCardId: {} }

  const { data: items, error: itemsError } = await supabase
    .from('todo_items')
    .select('*')
    .in('card_id', cardIds)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (itemsError) {
    console.error('Error fetching todo items:', itemsError)
  }

  const itemsByCardId: Record<string, TodoItemRow[]> = {}
  for (const item of (items ?? []) as TodoItemRow[]) {
    if (!itemsByCardId[item.card_id]) itemsByCardId[item.card_id] = []
    itemsByCardId[item.card_id].push(item)
  }

  return { cards: cards as TodoCardRow[], itemsByCardId }
}

export async function createTodoCard(input?: {
  title?: string
  is_shared?: boolean
  color?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' as const }

  const { data, error } = await supabase
    .from('todo_cards')
    .insert({
      owner_id: user.id,
      title: input?.title ?? 'New To Do',
      is_shared: input?.is_shared ?? true,
      color: input?.color ?? 'yellow',
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath('/todos')
  revalidatePath('/dashboard')
  return { success: true, id: data.id }
}

export async function updateTodoCard(
  id: string,
  updates: Partial<Pick<TodoCardRow, 'title' | 'is_shared' | 'color'>>
) {
  const supabase = await createClient()
  const { error } = await supabase.from('todo_cards').update(updates).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/todos')
  return { success: true }
}

export async function deleteTodoCard(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('todo_cards').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/todos')
  return { success: true }
}

export async function addTodoItem(cardId: string, text: string) {
  const supabase = await createClient()
  const trimmed = text.trim()
  if (!trimmed) return { success: false, error: 'Text is required' as const }

  const { data: maxItem } = await supabase
    .from('todo_items')
    .select('position')
    .eq('card_id', cardId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextPosition = (maxItem?.position ?? -1) + 1

  const { error } = await supabase
    .from('todo_items')
    .insert({ card_id: cardId, text: trimmed, position: nextPosition })

  if (error) return { success: false, error: error.message }
  await supabase.from('todo_cards').update({ updated_at: new Date().toISOString() }).eq('id', cardId)
  revalidatePath('/todos')
  return { success: true }
}

export async function updateTodoItem(
  id: string,
  updates: Partial<Pick<TodoItemRow, 'text' | 'is_done' | 'position'>>
) {
  const supabase = await createClient()
  const payload = { ...updates }
  if (typeof payload.text === 'string') payload.text = payload.text.trim()
  const { error } = await supabase.from('todo_items').update(payload).eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/todos')
  return { success: true }
}

export async function deleteTodoItem(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('todo_items').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/todos')
  return { success: true }
}
