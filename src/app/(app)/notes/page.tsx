import Link from 'next/link'
import { getProfileNamesByUserIds } from '@/lib/supabase/profile'
import { getNotes, getNoteFolders, getNoteTags } from './actions'
import { NotesList } from './notes-list'
import { NotesSidebar } from './notes-sidebar'
import styles from './notes.module.css'

type Props = {
  searchParams: Promise<{ folder?: string; tag?: string; q?: string }>
}

export default async function NotesPage({ searchParams }: Props) {
  const params = await searchParams
  const [notes, folders, tags] = await Promise.all([
    getNotes({
      folder: params.folder || null,
      tag: params.tag || null,
      search: params.q || null,
    }),
    getNoteFolders(),
    getNoteTags(),
  ])
  const ownerNames = await getProfileNamesByUserIds(notes.map((note) => note.owner_id))

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Notes</h1>
        <Link href="/notes/new" className={styles.newButton}>
          + New Note
        </Link>
      </div>

      <div className={styles.layout}>
        <NotesSidebar
          folders={folders}
          tags={tags}
          activeFolder={params.folder}
          activeTag={params.tag}
        />
        <NotesList
          notes={notes}
          ownerNames={ownerNames}
          searchQuery={params.q}
        />
      </div>
    </div>
  )
}
