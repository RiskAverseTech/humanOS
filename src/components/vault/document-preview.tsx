'use client'

import { useState, useEffect, useRef } from 'react'
import { getDocumentUrl, type DocumentRow } from '@/app/(app)/vault/actions'
import styles from './document-preview.module.css'

type DocumentPreviewProps = {
  document: DocumentRow
  ownerName?: string
  onClose: () => void
  onPrev?: () => void
  onNext?: () => void
  positionLabel?: string
}

export function DocumentPreview({ document, ownerName, onClose, onPrev, onNext, positionLabel }: DocumentPreviewProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const touchStartXRef = useRef<number | null>(null)

  useEffect(() => {
    async function loadUrl() {
      const signedUrl = await getDocumentUrl(document.storage_path)
      setUrl(signedUrl)
      setLoading(false)
    }
    loadUrl()
  }, [document.storage_path])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' && onPrev) {
        e.preventDefault()
        onPrev()
      }
      if (e.key === 'ArrowRight' && onNext) {
        e.preventDefault()
        onNext()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onPrev, onNext, onClose])

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
            {positionLabel && <span className={styles.positionLabel}>{positionLabel}</span>}
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
          {(onPrev || onNext) && (
            <>
              {onPrev && (
                <button
                  type="button"
                  className={`${styles.navButton} ${styles.navButtonPrev}`}
                  onClick={onPrev}
                  aria-label="Previous file"
                >
                  ‹
                </button>
              )}
              {onNext && (
                <button
                  type="button"
                  className={`${styles.navButton} ${styles.navButtonNext}`}
                  onClick={onNext}
                  aria-label="Next file"
                >
                  ›
                </button>
              )}
            </>
          )}
          {loading ? (
            <p className={styles.loadingText}>Loading preview...</p>
          ) : !url ? (
            <p className={styles.loadingText}>Failed to load preview</p>
          ) : isImage ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={url}
              alt={document.file_name}
              className={styles.previewImage}
              onTouchStart={(e) => {
                touchStartXRef.current = e.changedTouches[0]?.clientX ?? null
              }}
              onTouchEnd={(e) => {
                const startX = touchStartXRef.current
                const endX = e.changedTouches[0]?.clientX ?? null
                touchStartXRef.current = null
                if (startX == null || endX == null) return
                const dx = endX - startX
                if (Math.abs(dx) < 40) return
                if (dx < 0) onNext?.()
                else onPrev?.()
              }}
            />
          ) : isPdf ? (
            <iframe
              src={url}
              className={styles.previewPdf}
              title={document.file_name}
              onTouchStart={(e) => {
                touchStartXRef.current = e.changedTouches[0]?.clientX ?? null
              }}
              onTouchEnd={(e) => {
                const startX = touchStartXRef.current
                const endX = e.changedTouches[0]?.clientX ?? null
                touchStartXRef.current = null
                if (startX == null || endX == null) return
                const dx = endX - startX
                if (Math.abs(dx) < 40) return
                if (dx < 0) onNext?.()
                else onPrev?.()
              }}
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
