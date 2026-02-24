'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { TiptapEditor } from '@/components/editor/tiptap-editor'
import { updateNote, deleteNote, createNote, type NoteRow } from './actions'
import styles from './note-editor-view.module.css'

type NoteEditorViewProps = {
  note?: NoteRow | null
  isNew?: boolean
  initialFolder?: string
}

export function NoteEditorView({ note, isNew, initialFolder }: NoteEditorViewProps) {
  const router = useRouter()
  const [title, setTitle] = useState(note?.title ?? '')
  const [content, setContent] = useState(note?.content ?? '')
  const [isShared, setIsShared] = useState(note?.is_shared ?? true)
  const [tags, setTags] = useState(note?.tags?.join(', ') ?? '')
  const [folderPath, setFolderPath] = useState(note?.folder_path ?? initialFolder ?? '')
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [noteId, setNoteId] = useState(note?.id ?? null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setTitle(note?.title ?? '')
    setContent(note?.content ?? '')
    setIsShared(note?.is_shared ?? true)
    setTags(note?.tags?.join(', ') ?? '')
    setFolderPath(note?.folder_path ?? initialFolder ?? '')
    setNoteId(note?.id ?? null)
  }, [note?.id, note?.title, note?.content, note?.is_shared, note?.folder_path, note?.tags, initialFolder])

  // Auto-save on content changes (debounced 1.5s)
  const autoSave = useCallback(
    async (updatedContent: string) => {
      if (!noteId) return

      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(async () => {
        setSaving(true)
        await updateNote(noteId, { content: updatedContent }, { logEvent: false })
        setLastSaved(new Date())
        setSaving(false)
      }, 1500)
    },
    [noteId]
  )

  function handleContentUpdate(html: string) {
    setContent(html)
    autoSave(html)
  }

  async function handleSave() {
    setSaving(true)

    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    if (isNew && !noteId) {
      const newId = await createNote({
        title: title || 'Untitled',
        content,
        folder_path: folderPath || null,
        is_shared: isShared,
        tags: parsedTags,
      })

      if (newId) {
        setNoteId(newId)
        setLastSaved(new Date())
        router.replace(`/notes/${newId}`)
      }
    } else if (noteId) {
      await updateNote(noteId, {
        title: title || 'Untitled',
        content,
        folder_path: folderPath || null,
        is_shared: isShared,
        tags: parsedTags,
      })
      setLastSaved(new Date())
    }

    setSaving(false)
  }

  async function handleDelete() {
    if (!noteId) return
    if (!confirm('Delete this note? This cannot be undone.')) return

    await deleteNote(noteId)
    router.push('/notes')
  }

  // Save on Cmd+S / Ctrl+S
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave])

  return (
    <div className={styles.container}>
      {/* Title bar */}
      <div className={styles.titleBar}>
        <button
          className={styles.backButton}
          onClick={() => router.push('/notes')}
        >
          &larr; Notes
        </button>
        <div className={styles.titleActions}>
          <span className={styles.saveStatus}>
            {saving ? 'Saving...' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : ''}
          </span>
          <button className={styles.saveButton} onClick={handleSave} disabled={saving}>
            {isNew && !noteId ? 'Create' : 'Save'}
          </button>
          {noteId && (
            <button className={styles.deleteButton} onClick={handleDelete}>
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Title input */}
      <input
        type="text"
        className={styles.titleInput}
        placeholder="Note title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={handleSave}
      />

      {/* Metadata bar */}
      <div className={styles.metaBar}>
        <div className={styles.metaField}>
          <label className={styles.metaLabel}>Folder</label>
          <input
            type="text"
            className={styles.metaInput}
            placeholder="e.g. Projects"
            value={folderPath}
            onChange={(e) => setFolderPath(e.target.value)}
          />
        </div>
        <div className={styles.metaField}>
          <label className={styles.metaLabel}>Tags</label>
          <input
            type="text"
            className={styles.metaInput}
            placeholder="comma-separated"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />
        </div>
        <div className={styles.metaField}>
          <label className={styles.sharedToggle}>
            <input
              type="checkbox"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
            />
            <span>Share with family</span>
          </label>
        </div>
      </div>

      {/* Editor */}
      <TiptapEditor
        content={content}
        onUpdate={handleContentUpdate}
      />
    </div>
  )
}
