'use client'

import type { Editor } from '@tiptap/react'
import styles from './editor-toolbar.module.css'

type ToolbarProps = {
  editor: Editor
}

export function EditorToolbar({ editor }: ToolbarProps) {
  const items = [
    {
      label: 'B',
      title: 'Bold',
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: editor.isActive('bold'),
    },
    {
      label: 'I',
      title: 'Italic',
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: editor.isActive('italic'),
    },
    {
      label: 'S',
      title: 'Strikethrough',
      action: () => editor.chain().focus().toggleStrike().run(),
      isActive: editor.isActive('strike'),
    },
    {
      label: '</>',
      title: 'Inline code',
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: editor.isActive('code'),
    },
    { type: 'divider' as const },
    {
      label: 'H1',
      title: 'Heading 1',
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: editor.isActive('heading', { level: 1 }),
    },
    {
      label: 'H2',
      title: 'Heading 2',
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: editor.isActive('heading', { level: 2 }),
    },
    {
      label: 'H3',
      title: 'Heading 3',
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: editor.isActive('heading', { level: 3 }),
    },
    { type: 'divider' as const },
    {
      label: '•',
      title: 'Bullet list',
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: editor.isActive('bulletList'),
    },
    {
      label: '1.',
      title: 'Ordered list',
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: editor.isActive('orderedList'),
    },
    {
      label: '☑',
      title: 'Task list',
      action: () => editor.chain().focus().toggleTaskList().run(),
      isActive: editor.isActive('taskList'),
    },
    { type: 'divider' as const },
    {
      label: '❝',
      title: 'Blockquote',
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: editor.isActive('blockquote'),
    },
    {
      label: '—',
      title: 'Horizontal rule',
      action: () => editor.chain().focus().setHorizontalRule().run(),
      isActive: false,
    },
    {
      label: '{}',
      title: 'Code block',
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: editor.isActive('codeBlock'),
    },
  ]

  return (
    <div className={styles.toolbar}>
      {items.map((item, index) => {
        if ('type' in item && item.type === 'divider') {
          return <div key={index} className={styles.divider} />
        }

        const btn = item as { label: string; title: string; action: () => void; isActive: boolean }
        return (
          <button
            key={btn.title}
            type="button"
            className={`${styles.button} ${btn.isActive ? styles.active : ''}`}
            onClick={btn.action}
            title={btn.title}
          >
            {btn.label}
          </button>
        )
      })}
    </div>
  )
}
