'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import styles from './emoji-picker.module.css'

const EMOJI_CATEGORIES = [
  {
    key: 'smileys',
    label: '🙂',
    title: 'Smileys',
    emojis: ['😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘', '😉', '🙂', '😅', '😭', '😎', '🤔', '🤩', '🥳', '😇', '😬', '🤯', '😴', '😡', '😌', '😋', '🫠'],
  },
  {
    key: 'people',
    label: '🙌',
    title: 'People',
    emojis: ['👍', '👎', '🙏', '🙌', '👏', '💪', '🤝', '👌', '🤗', '👋', '🫡', '🫶', '👏🏻', '👏🏽', '👏🏿', '👍🏻', '👍🏽', '👍🏿', '👀', '💯'],
  },
  {
    key: 'animals',
    label: '🐶',
    title: 'Animals',
    emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🦄', '🐙', '🐬', '🐢', '🦋', '🐝'],
  },
  {
    key: 'nature',
    label: '🌿',
    title: 'Nature',
    emojis: ['☀️', '🌙', '⭐', '🌈', '⚡', '🌟', '🔥', '✨', '🌻', '🌹', '🌴', '🌲', '🌿', '🍀', '🌊', '⛈️', '❄️'],
  },
  {
    key: 'food',
    label: '🍕',
    title: 'Food',
    emojis: ['☕', '🍕', '🍿', '🎂', '🍔', '🍟', '🌮', '🍣', '🍩', '🍪', '🍎', '🍓', '🍉', '🥤', '🍺'],
  },
  {
    key: 'objects',
    label: '📦',
    title: 'Objects',
    emojis: ['🎉', '🎁', '🏆', '🎵', '📚', '🧠', '📌', '📝', '📷', '🖼️', '🤖', '💬', '🚀', '✅', '❌', '⚠️', '📦'],
  },
  {
    key: 'symbols',
    label: '❤️',
    title: 'Symbols',
    emojis: ['❤️', '💖', '💙', '💚', '🧡', '💜', '🩷', '🤍', '🖤', '💕', '💞', '💥', '⭐', '✨', '✅', '❌'],
  },
] as const

export function EmojiPickerButton({
  onSelect,
  disabled,
  title = 'Add emoji',
  compact = false,
  triggerContent,
  panelAlign = 'left',
}: {
  onSelect: (emoji: string) => void
  disabled?: boolean
  title?: string
  compact?: boolean
  triggerContent?: React.ReactNode
  panelAlign?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const [openBelow, setOpenBelow] = useState(false)
  const [activeCategory, setActiveCategory] = useState<(typeof EMOJI_CATEGORIES)[number]['key']>('smileys')
  const id = useMemo(() => `emoji-panel-${Math.random().toString(36).slice(2)}`, [])
  const panelRef = useRef<HTMLDivElement>(null)
  const activeCategoryData =
    EMOJI_CATEGORIES.find((category) => category.key === activeCategory) ?? EMOJI_CATEGORIES[0]

  useEffect(() => {
    if (!open) {
      setOpenBelow(false)
      setActiveCategory('smileys')
      return
    }
    function positionPanel() {
      const panel = panelRef.current
      if (!panel) return
      const rect = panel.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const spaceAbove = rect.top
      const spaceBelow = viewportHeight - rect.top
      const needsFlipBelow = rect.top < 8 && spaceBelow > spaceAbove
      setOpenBelow(needsFlipBelow)
    }
    positionPanel()
    window.addEventListener('resize', positionPanel)
    return () => window.removeEventListener('resize', positionPanel)
  }, [open])

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.trigger} ${compact ? styles.triggerCompact : ''}`}
        aria-label={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={title}
      >
        {triggerContent ?? '😊'}
      </button>

      {open && (
        <>
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Close emoji picker"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            className={`${styles.panel} ${panelAlign === 'right' ? styles.panelRight : ''} ${openBelow ? styles.panelBelow : ''}`}
            id={id}
            role="dialog"
            aria-label="Emoji picker"
          >
            <div className={styles.header}>
              <span className={styles.title}>Pick an emoji • {activeCategoryData.title}</span>
              <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className={styles.tabs} role="tablist" aria-label="Emoji categories">
              {EMOJI_CATEGORIES.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  role="tab"
                  aria-selected={activeCategory === category.key}
                  className={`${styles.tab} ${activeCategory === category.key ? styles.tabActive : ''}`}
                  onClick={() => setActiveCategory(category.key)}
                  title={category.title}
                >
                  {category.label}
                </button>
              ))}
            </div>
            <div className={styles.grid}>
              {activeCategoryData.emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={styles.emojiBtn}
                  onClick={() => {
                    onSelect(emoji)
                    setOpen(false)
                  }}
                  aria-label={`Insert ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
