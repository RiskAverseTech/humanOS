'use client'

import { useMemo, useState } from 'react'
import styles from './emoji-picker.module.css'

const EMOJIS = [
  '😀', '😁', '😂', '🤣', '😊', '😍', '🥰', '😘',
  '🤔', '😅', '😭', '😎', '🙌', '👏', '🔥', '❤️',
  '👍', '👎', '🙏', '🎉', '✨', '🚀', '💯', '👀',
  '😬', '🤯', '😴', '🤝', '👌', '🤗', '😡', '😇',
]

export function EmojiPickerButton({
  onSelect,
  disabled,
  title = 'Add emoji',
}: {
  onSelect: (emoji: string) => void
  disabled?: boolean
  title?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useMemo(() => `emoji-panel-${Math.random().toString(36).slice(2)}`, [])

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title={title}
      >
        😊
      </button>

      {open && (
        <>
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Close emoji picker"
            onClick={() => setOpen(false)}
          />
          <div className={styles.panel} id={id} role="dialog" aria-label="Emoji picker">
            <div className={styles.header}>
              <span className={styles.title}>Pick an emoji</span>
              <button type="button" className={styles.close} onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className={styles.grid}>
              {EMOJIS.map((emoji) => (
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

