'use client'

import { useState, useEffect } from 'react'
import { getDocumentUrl, type DocumentRow } from '@/app/(app)/vault/actions'
import styles from './document-preview.module.css'

type DocumentPreviewProps = {
  document: DocumentRow
  ownerName?: string
  onClose: () => void
}

export function DocumentPreview({ document, ownerName, onClose }: DocumentPreviewProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUrl() {
      const signedUrl = await getDocumentUrl(document.storage_path)
      setUrl(signedUrl)
      setLoading(false)
    }
    loadUrl()
  }, [document.storage_path])

  const isImage = document.mime_type.startsWith('image/')
  const isPdf = document.mime_type === 'application/pdf'

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerInfo}>
            <h2 className={styles.fileName}>{document.file_name}</h2>
            <span className={styles.meta}>
              {formatFileSize(document.size)} · {document.mime_type}{ownerName ? ` · By ${ownerName}` : ''}
            </span>
          </div>
          <div className={styles.headerActions}>
            {url && (
              <a
                href={url}
                download={document.file_name}
                className={styles.downloadButton}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download
              </a>
            )}
            <button className={styles.closeButton} onClick={onClose}>
              &times;
            </button>
          </div>
        </div>

        <div className={styles.previewArea}>
          {loading ? (
            <p className={styles.loadingText}>Loading preview...</p>
          ) : !url ? (
            <p className={styles.loadingText}>Failed to load preview</p>
          ) : isImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={url} alt={document.file_name} className={styles.previewImage} />
          ) : isPdf ? (
            <iframe
              src={url}
              className={styles.previewPdf}
              title={document.file_name}
            />
          ) : (
            <div className={styles.noPreview}>
              <span className={styles.noPreviewIcon}>{getFileIcon(document.mime_type)}</span>
              <p>No preview available for this file type.</p>
              <a
                href={url}
                download={document.file_name}
                className={styles.downloadLink}
                target="_blank"
                rel="noopener noreferrer"
              >
                Download to view
              </a>
            </div>
          )}
        </div>

        {document.tags.length > 0 && (
          <div className={styles.tags}>
            {document.tags.map((tag) => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️'
  if (mimeType === 'application/pdf') return '📕'
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊'
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📽️'
  if (mimeType.includes('document') || mimeType.includes('word')) return '📄'
  if (mimeType.includes('zip') || mimeType.includes('archive')) return '📦'
  if (mimeType.startsWith('video/')) return '🎬'
  if (mimeType.startsWith('audio/')) return '🎵'
  if (mimeType.startsWith('text/')) return '📝'
  return '📎'
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
