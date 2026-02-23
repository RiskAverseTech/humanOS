'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileUpload } from '@/components/vault/file-upload'
import { DocumentPreview, getFileIcon, formatFileSize } from '@/components/vault/document-preview'
import { createDocumentRecord, updateDocument, deleteDocument, type DocumentRow } from './actions'
import styles from './vault-client.module.css'

type VaultClientProps = {
  documents: DocumentRow[]
  ownerNames: Record<string, string>
  folders: string[]
  tags: string[]
  activeFolder?: string
  activeTag?: string
  searchQuery?: string
}

export function VaultClient({
  documents,
  ownerNames,
  folders,
  tags,
  activeFolder,
  activeTag,
  searchQuery,
}: VaultClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState(searchQuery ?? '')
  const [previewDoc, setPreviewDoc] = useState<DocumentRow | null>(null)
  const [showUpload, setShowUpload] = useState(false)

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (search.trim()) params.set('q', search.trim())
    router.push(`/vault?${params.toString()}`)
  }

  const handleUploadComplete = useCallback(
    async (file: { fileName: string; storagePath: string; mimeType: string; size: number; isShared: boolean }) => {
      await createDocumentRecord({
        file_name: file.fileName,
        storage_path: file.storagePath,
        mime_type: file.mimeType,
        size: file.size,
        folder_path: activeFolder || null,
        is_shared: file.isShared,
      })
      setShowUpload(false)
      router.refresh()
    },
    [activeFolder, router]
  )

  async function handleDelete(id: string) {
    if (!confirm('Delete this document? This cannot be undone.')) return
    await deleteDocument(id)
    router.refresh()
  }

  async function handleToggleShared(doc: DocumentRow) {
    await updateDocument(doc.id, { is_shared: !doc.is_shared })
    router.refresh()
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Document Vault</h1>
        <button
          className={styles.uploadButton}
          onClick={() => setShowUpload(!showUpload)}
        >
          {showUpload ? 'Cancel' : '+ Upload'}
        </button>
      </div>

      {showUpload && (
        <FileUpload
          folderPath={activeFolder}
          onUploadComplete={handleUploadComplete}
        />
      )}

      <div className={styles.layout}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <a
            href="/vault"
            className={`${styles.sidebarItem} ${!activeFolder && !activeTag ? styles.sidebarActive : ''}`}
          >
            All Documents
          </a>

          {folders.length > 0 && (
            <div className={styles.sidebarSection}>
              <h3 className={styles.sidebarTitle}>Folders</h3>
              {folders.map((folder) => (
                <a
                  key={folder}
                  href={`/vault?folder=${encodeURIComponent(folder)}`}
                  className={`${styles.sidebarItem} ${activeFolder === folder ? styles.sidebarActive : ''}`}
                >
                  📁 {folder}
                </a>
              ))}
            </div>
          )}

          {tags.length > 0 && (
            <div className={styles.sidebarSection}>
              <h3 className={styles.sidebarTitle}>Tags</h3>
              <div className={styles.tagList}>
                {tags.map((tag) => (
                  <a
                    key={tag}
                    href={`/vault?tag=${encodeURIComponent(tag)}`}
                    className={`${styles.tagChip} ${activeTag === tag ? styles.tagActive : ''}`}
                  >
                    {tag}
                  </a>
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className={styles.main}>
          <form onSubmit={handleSearch} className={styles.searchForm}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit" className={styles.searchButton}>
              Search
            </button>
          </form>

          {documents.length === 0 ? (
            <div className={styles.empty}>
              <p>{searchQuery ? 'No documents match your search.' : 'No documents yet. Upload your first file!'}</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {documents.map((doc) => (
                <div key={doc.id} className={styles.card}>
                  <div
                    className={styles.cardPreview}
                    onClick={() => setPreviewDoc(doc)}
                  >
                    <span className={styles.cardIcon}>{getFileIcon(doc.mime_type)}</span>
                  </div>
                  <div className={styles.cardBody}>
                    <h3
                      className={styles.cardName}
                      onClick={() => setPreviewDoc(doc)}
                      title={doc.file_name}
                    >
                      {doc.file_name}
                    </h3>
                    <div className={styles.cardMeta}>
                      <span>{formatFileSize(doc.size)}</span>
                      <span>By {ownerNames[doc.owner_id] ?? 'Unknown'}</span>
                      <span>
                        {new Date(doc.created_at).toLocaleDateString('en-AU', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                    <div className={styles.cardActions}>
                      <button
                        className={`${styles.sharedChip} ${doc.is_shared ? styles.sharedActive : ''}`}
                        onClick={() => handleToggleShared(doc)}
                        title={doc.is_shared ? 'Click to make private' : 'Click to share'}
                      >
                        {doc.is_shared ? 'Shared' : 'Private'}
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(doc.id)}
                      >
                        &times;
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview modal */}
      {previewDoc && (
        <DocumentPreview
          document={previewDoc}
          ownerName={ownerNames[previewDoc.owner_id]}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  )
}
