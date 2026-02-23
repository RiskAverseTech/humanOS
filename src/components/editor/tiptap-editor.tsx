'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Highlight from '@tiptap/extension-highlight'
import Typography from '@tiptap/extension-typography'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { common, createLowlight } from 'lowlight'
import { EditorToolbar } from './editor-toolbar'
import { SlashCommandMenu } from './slash-command-menu'
import styles from './tiptap-editor.module.css'

const lowlight = createLowlight(common)

type TiptapEditorProps = {
  content: string
  onUpdate: (html: string) => void
  editable?: boolean
}

export function TiptapEditor({ content, onUpdate, editable = true }: TiptapEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false, // replaced by CodeBlockLowlight
      }),
      Placeholder.configure({
        placeholder: 'Start writing, or type / for commands...',
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: styles.link },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight,
      Typography,
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onUpdate(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: styles.prosemirror,
      },
    },
  })

  if (!editor) return null

  return (
    <div className={styles.editor}>
      {editable && <EditorToolbar editor={editor} />}
      <SlashCommandMenu editor={editor} />
      <EditorContent editor={editor} className={styles.content} />
    </div>
  )
}
