'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import styles from './slash-command-menu.module.css'

const COMMANDS = [
  { label: 'Heading 1', icon: 'H1', description: 'Large heading', action: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'Heading 2', icon: 'H2', description: 'Medium heading', action: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'Heading 3', icon: 'H3', description: 'Small heading', action: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { label: 'Bullet List', icon: '•', description: 'Unordered list', action: (e: Editor) => e.chain().focus().toggleBulletList().run() },
  { label: 'Numbered List', icon: '1.', description: 'Ordered list', action: (e: Editor) => e.chain().focus().toggleOrderedList().run() },
  { label: 'Task List', icon: '☑', description: 'Checklist', action: (e: Editor) => e.chain().focus().toggleTaskList().run() },
  { label: 'Code Block', icon: '{}', description: 'Code with syntax highlighting', action: (e: Editor) => e.chain().focus().toggleCodeBlock().run() },
  { label: 'Blockquote', icon: '❝', description: 'Quote block', action: (e: Editor) => e.chain().focus().toggleBlockquote().run() },
  { label: 'Horizontal Rule', icon: '—', description: 'Divider line', action: (e: Editor) => e.chain().focus().setHorizontalRule().run() },
]

type SlashCommandMenuProps = {
  editor: Editor
}

export function SlashCommandMenu({ editor }: SlashCommandMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  const filteredCommands = COMMANDS.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  )

  const executeCommand = useCallback(
    (index: number) => {
      const command = filteredCommands[index]
      if (!command) return

      // Delete the slash and any query text
      const { from } = editor.state.selection
      const textBefore = editor.state.doc.textBetween(
        Math.max(0, from - query.length - 1),
        from,
        '\n'
      )
      const slashPos = textBefore.lastIndexOf('/')
      if (slashPos !== -1) {
        const deleteFrom = from - query.length - 1
        editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).run()
      }

      command.action(editor)
      setIsOpen(false)
      setQuery('')
    },
    [editor, filteredCommands, query]
  )

  useEffect(() => {
    if (!editor) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isOpen) {
        if (event.key === '/' && !editor.isActive('codeBlock')) {
          // Check if we're at the start of a line or after whitespace
          const { from } = editor.state.selection
          const textBefore = from > 1 ? editor.state.doc.textBetween(from - 1, from) : ''
          if (from === 1 || textBefore === '' || textBefore === '\n' || textBefore === ' ') {
            // Wait a tick for the / to be inserted, then open menu
            setTimeout(() => {
              setIsOpen(true)
              setQuery('')
              setSelectedIndex(0)
            }, 10)
          }
        }
        return
      }

      if (event.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
        return
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((i) => (i + 1) % filteredCommands.length)
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((i) => (i - 1 + filteredCommands.length) % filteredCommands.length)
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        executeCommand(selectedIndex)
        return
      }

      if (event.key === 'Backspace') {
        if (query.length === 0) {
          setIsOpen(false)
        } else {
          setQuery((q) => q.slice(0, -1))
          setSelectedIndex(0)
        }
        return
      }

      if (event.key.length === 1 && !event.metaKey && !event.ctrlKey) {
        setQuery((q) => q + event.key)
        setSelectedIndex(0)
      }
    }

    const dom = editor.view.dom
    dom.addEventListener('keydown', handleKeyDown)
    return () => dom.removeEventListener('keydown', handleKeyDown)
  }, [editor, isOpen, query, selectedIndex, filteredCommands.length, executeCommand])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  if (!isOpen || filteredCommands.length === 0) return null

  return (
    <div className={styles.menu} ref={menuRef}>
      {filteredCommands.map((cmd, index) => (
        <button
          key={cmd.label}
          type="button"
          className={`${styles.item} ${index === selectedIndex ? styles.selected : ''}`}
          onClick={() => executeCommand(index)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          <span className={styles.icon}>{cmd.icon}</span>
          <div className={styles.text}>
            <span className={styles.label}>{cmd.label}</span>
            <span className={styles.description}>{cmd.description}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
