'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteNoteFolder, renameNoteFolder } from './actions'
import styles from './notes-sidebar.module.css'

type NotesSidebarProps = {
  folders: string[]
  tags: string[]
  activeFolder?: string
  activeTag?: string
}

export function NotesSidebar({ folders, tags, activeFolder, activeTag }: NotesSidebarProps) {
  const router = useRouter()

  async function handleCreateFolder() {
    const name = window.prompt('New folder name')
    const trimmed = name?.trim()
    if (!trimmed) return
    router.push(`/notes/new?folder=${encodeURIComponent(trimmed)}`)
  }

  async function handleRenameFolder() {
    if (!activeFolder) return
    const next = window.prompt('Rename folder', activeFolder)
    const trimmed = next?.trim()
    if (!trimmed || trimmed === activeFolder) return
    const result = await renameNoteFolder(activeFolder, trimmed)
    if (!result.success) {
      window.alert(result.error || 'Could not rename folder')
      return
    }
    router.push(`/notes?folder=${encodeURIComponent(trimmed)}`)
    router.refresh()
  }

  async function handleDeleteFolder() {
    if (!activeFolder) return
    const ok = window.confirm(`Delete folder "${activeFolder}"?\nNotes will be kept, but removed from this folder.`)
    if (!ok) return
    const result = await deleteNoteFolder(activeFolder)
    if (!result.success) {
      window.alert(result.error || 'Could not delete folder')
      return
    }
    router.push('/notes')
    router.refresh()
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.section}>
        <Link
          href="/notes"
          className={`${styles.item} ${!activeFolder && !activeTag ? styles.active : ''}`}
        >
          All Notes
        </Link>
        <button type="button" className={styles.folderActionBtn} onClick={() => void handleCreateFolder()}>
          + New Folder
        </button>
        {activeFolder && (
          <div className={styles.folderActionsRow}>
            <button type="button" className={styles.folderActionBtn} onClick={() => void handleRenameFolder()}>
              Rename Folder
            </button>
            <button type="button" className={`${styles.folderActionBtn} ${styles.folderDangerBtn}`} onClick={() => void handleDeleteFolder()}>
              Delete Folder
            </button>
          </div>
        )}
        <p className={styles.helperText}>Folders are created when you save a note into them.</p>
      </div>

      {folders.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Folders</h3>
          {folders.map((folder) => (
            <Link
              key={folder}
              href={`/notes?folder=${encodeURIComponent(folder)}`}
              className={`${styles.item} ${activeFolder === folder ? styles.active : ''}`}
            >
              <span className={styles.icon}>📁</span>
              {folder}
            </Link>
          ))}
        </div>
      )}

      {tags.length > 0 && (
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Tags</h3>
          <div className={styles.tagList}>
            {tags.map((tag) => (
              <Link
                key={tag}
                href={`/notes?tag=${encodeURIComponent(tag)}`}
                className={`${styles.tag} ${activeTag === tag ? styles.tagActive : ''}`}
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}
