'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { NoteRow } from './actions'
import styles from './notes-list.module.css'

type NotesListProps = {
  notes: NoteRow[]
  ownerNames: Record<string, string>
  searchQuery?: string
}

export function NotesList({ notes, ownerNames, searchQuery }: NotesListProps) {
  const router = useRouter()
  const [search, setSearch] = useState(searchQuery ?? '')

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    router.push(`/notes?${params.toString()}`)
  }

  return (
    <div className={styles.container}>
      <form onSubmit={handleSearch} className={styles.searchForm}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button type="submit" className={styles.searchButton}>
          Search
        </button>
      </form>

      {notes.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            {searchQuery ? 'No notes match your search.' : 'No notes yet. Create your first one!'}
          </p>
        </div>
      ) : (
        <div className={styles.list}>
          {notes.map((note) => (
            <Link
              key={note.id}
              href={`/notes/${note.id}`}
              className={styles.card}
            >
              <div className={styles.cardHeader}>
                <h3 className={styles.cardTitle}>{note.title || 'Untitled'}</h3>
                {note.is_shared && <span className={styles.sharedBadge}>Shared</span>}
              </div>
              <p className={styles.cardPreview}>
                {stripHtml(note.content ?? '').slice(0, 120) || 'Empty note'}
              </p>
              <div className={styles.cardMeta}>
                <div className={styles.cardByline}>
                  <span className={styles.cardAuthor}>By {ownerNames[note.owner_id] ?? 'Unknown'}</span>
                  <span className={styles.cardDate}>
                    {new Date(note.updated_at).toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
                {note.tags.length > 0 && (
                  <div className={styles.cardTags}>
                    {note.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}
