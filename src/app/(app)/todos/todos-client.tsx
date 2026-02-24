'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/components/providers/profile-provider'
import {
  addTodoItem,
  createTodoCard,
  deleteTodoCard,
  deleteTodoItem,
  updateTodoCard,
  updateTodoItem,
  type TodoCardRow,
  type TodoItemRow,
} from './actions'
import styles from './todos.module.css'

type Props = {
  cards: TodoCardRow[]
  itemsByCardId: Record<string, TodoItemRow[]>
  ownerNames: Record<string, string>
}

export function TodosClient({ cards, itemsByCardId, ownerNames }: Props) {
  const router = useRouter()
  const profile = useProfile()
  const [creating, setCreating] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState('New To Do')

  async function handleCreateCard() {
    setCreating(true)
    await createTodoCard({ is_shared: true, title: newCardTitle.trim() || 'New To Do' })
    setCreating(false)
    setShowCreateModal(false)
    setNewCardTitle('New To Do')
    router.refresh()
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>To Dos</h1>
          <p className={styles.subtitle}>Sticky list cards for quick shared tasks</p>
        </div>
        <button className={styles.addCardBtn} onClick={() => setShowCreateModal(true)} disabled={creating}>
          {creating ? 'Adding...' : '+ New Sticky List'}
        </button>
      </div>

      {showCreateModal && (
        <div className={styles.createModalOverlay} onClick={() => !creating && setShowCreateModal(false)}>
          <div className={styles.createModalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.createModalHeader}>
              <h2 className={styles.createModalTitle}>New Sticky List</h2>
              <button
                type="button"
                className={styles.createModalClose}
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            <p className={styles.createModalText}>
              Give this sticky list a name. It will be shared with members by default.
            </p>
            <input
              className={styles.createModalInput}
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleCreateCard()
                }
                if (e.key === 'Escape' && !creating) {
                  e.preventDefault()
                  setShowCreateModal(false)
                }
              }}
              autoFocus
              maxLength={120}
            />
            <div className={styles.createModalActions}>
              <button
                type="button"
                className={styles.createModalSecondary}
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.createModalPrimary}
                onClick={() => void handleCreateCard()}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create List'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cards.length === 0 ? (
        <div className={styles.empty}>
          <p>No to-do lists yet. Create one to get started.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {cards.map((card) => (
            <TodoCard
              key={card.id}
              card={card}
              items={itemsByCardId[card.id] ?? []}
              ownerName={ownerNames[card.owner_id]}
              canEdit={card.is_shared || card.owner_id === profile.userId}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TodoCard({
  card,
  items,
  ownerName,
  canEdit,
}: {
  card: TodoCardRow
  items: TodoItemRow[]
  ownerName?: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [title, setTitle] = useState(card.title)
  const [newItem, setNewItem] = useState('')
  const [savingTitle, setSavingTitle] = useState(false)
  const [adding, setAdding] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTitle(card.title)
  }, [card.id, card.title])

  async function saveTitle() {
    if (!canEdit) return
    const nextTitle = title.trim() || 'Untitled list'
    setSavingTitle(true)
    await updateTodoCard(card.id, { title: nextTitle })
    setSavingTitle(false)
    router.refresh()
  }

  async function handleAddItem(e: React.FormEvent) {
    e.preventDefault()
    if (!newItem.trim()) return
    setAdding(true)
    const result = await addTodoItem(card.id, newItem)
    setAdding(false)
    if (result.success) {
      setNewItem('')
      router.refresh()
    }
  }

  async function handleToggleShared() {
    if (!canEdit) return
    await updateTodoCard(card.id, { is_shared: !card.is_shared })
    router.refresh()
  }

  async function handleDeleteCard() {
    if (!canEdit) return
    if (!confirm('Delete this to-do list?')) return
    await deleteTodoCard(card.id)
    router.refresh()
  }

  return (
    <section className={`${styles.card} ${styles[`card_${normalizeColor(card.color)}`] ?? ''}`}>
      <div className={styles.cardHeader}>
        <input
          ref={titleInputRef}
          className={styles.cardTitleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void saveTitle()
            }
          }}
          disabled={!canEdit || savingTitle}
          aria-label="Sticky list name"
          title={canEdit ? 'Rename sticky list' : undefined}
        />
        {canEdit && (
          <button
            type="button"
            className={styles.renameCardBtn}
            onClick={() => {
              titleInputRef.current?.focus()
              titleInputRef.current?.select()
            }}
            title="Rename list"
          >
            Rename
          </button>
        )}
        {canEdit && (
          <button
            className={styles.deleteCardBtn}
            onClick={() => void handleDeleteCard()}
            title="Delete list"
          >
            &times;
          </button>
        )}
      </div>

      <div className={styles.cardMeta}>
        <span className={`${styles.privacyChip} ${card.is_shared ? styles.sharedChip : styles.privateChip}`}>
          {card.is_shared ? 'Shared' : 'Private'}
        </span>
        {ownerName && <span className={styles.ownerText}>By {ownerName}</span>}
        {canEdit && (
          <button className={styles.metaBtn} onClick={() => void handleToggleShared()}>
            Make {card.is_shared ? 'Private' : 'Shared'}
          </button>
        )}
      </div>

      <ul className={styles.itemList}>
        {items.map((item) => (
          <TodoItem key={item.id} item={item} canEdit={canEdit} />
        ))}
      </ul>

      <form onSubmit={handleAddItem} className={styles.addItemForm}>
        <input
          className={styles.addItemInput}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={canEdit ? 'Add a to-do item...' : 'Read-only'}
          disabled={!canEdit || adding}
        />
        <button className={styles.addItemBtn} type="submit" disabled={!canEdit || adding || !newItem.trim()}>
          +
        </button>
      </form>
    </section>
  )
}

function TodoItem({ item, canEdit }: { item: TodoItemRow; canEdit: boolean }) {
  const router = useRouter()
  const [text, setText] = useState(item.text)
  const textRef = useRef<HTMLTextAreaElement>(null)

  function resizeTextArea() {
    const el = textRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${el.scrollHeight}px`
  }

  useEffect(() => {
    setText(item.text)
  }, [item.id, item.text])

  useEffect(() => {
    resizeTextArea()
  }, [text, item.id])

  async function toggleDone() {
    if (!canEdit) return
    await updateTodoItem(item.id, { is_done: !item.is_done })
    router.refresh()
  }

  async function saveText() {
    if (!canEdit) return
    const trimmed = text.trim()
    if (!trimmed) return
    await updateTodoItem(item.id, { text: trimmed })
    router.refresh()
  }

  async function remove() {
    if (!canEdit) return
    await deleteTodoItem(item.id)
    router.refresh()
  }

  return (
    <li className={styles.item}>
      <button
        type="button"
        className={`${styles.check} ${item.is_done ? styles.checkDone : ''}`}
        onClick={() => void toggleDone()}
        aria-label={item.is_done ? 'Mark incomplete' : 'Mark complete'}
        disabled={!canEdit}
      >
        {item.is_done ? '✓' : ''}
      </button>
      <textarea
        ref={textRef}
        className={`${styles.itemText} ${item.is_done ? styles.itemTextDone : ''}`}
        value={text}
        title={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => void saveText()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            void saveText()
          }
        }}
        disabled={!canEdit}
        rows={1}
      />
      {canEdit && (
        <button type="button" className={styles.removeItemBtn} onClick={() => void remove()} aria-label="Delete item">
          &times;
        </button>
      )}
    </li>
  )
}

function normalizeColor(color: string) {
  const allowed = new Set(['yellow', 'mint', 'blue', 'rose'])
  return allowed.has(color) ? color : 'yellow'
}
