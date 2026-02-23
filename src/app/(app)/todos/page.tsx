import { getProfileNamesByUserIds } from '@/lib/supabase/profile'
import { getTodoCardsWithItems } from './actions'
import { TodosClient } from './todos-client'

export default async function TodosPage() {
  const { cards, itemsByCardId } = await getTodoCardsWithItems()
  const ownerNames = await getProfileNamesByUserIds(cards.map((card) => card.owner_id))

  return (
    <TodosClient
      cards={cards}
      itemsByCardId={itemsByCardId}
      ownerNames={ownerNames}
    />
  )
}
