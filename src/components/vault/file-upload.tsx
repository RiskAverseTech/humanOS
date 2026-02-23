'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useProfile } from '@/components/providers/profile-provider'
import styles from './file-upload.module.css'

type FileUploadProps = {
  folderPath?: string
  onUploadComplete: (file: {
    fileName: string
    storagePath: string
    mimeType: string
    size: number
    isShared: boolean
  }) => void
}

export function FileUpload({ folderPath, onUploadComplete }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [shareWithFamily, setShareWithFamily] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const profile = useProfile()
  const supabase = createClient()

  const uploadFile = useCallback(
    async (file: File) => {
      setUploading(true)
      setProgress(`Uploading ${file.name}...`)

      const fileExt = file.name.split('.').pop()
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
      const storagePath = `${profile.userId}/${folderPath ? folderPath + '/' : ''}${uniqueName}`

      const { error } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (error) {
        console.error('Upload error:', error)
        setProgress(`Failed: ${error.message}`)
        setUploading(false)
        return
      }

      onUploadComplete({
        fileName: file.name,
        storagePath,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        isShared: shareWithFamily,
      })

      setProgress('')
      setUploading(false)
    },
    [supabase, profile.userId, folderPath, onUploadComplete, shareWithFamily]
  )

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    for (const file of files) {
      await uploadFile(file)
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    for (const file of files) {
      await uploadFile(file)
    }
    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div
      className={`${styles.dropzone} ${isDragging ? styles.dragging : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        className={styles.fileInput}
        onChange={handleFileSelect}
        multiple
      />

      {uploading ? (
        <p className={styles.uploadingText}>{progress}</p>
      ) : (
        <>
          <span className={styles.icon}>📄</span>
          <p className={styles.text}>
            Drag & drop files here, or <span className={styles.link}>browse</span>
          </p>
          <p className={styles.hint}>PDF, images, docs — up to 50MB</p>
          <label className={styles.shareToggle} onClick={(e) => e.stopPropagation()}>
            <input
              type="checkbox"
              checked={shareWithFamily}
              onChange={(e) => setShareWithFamily(e.target.checked)}
            />
            <span>{shareWithFamily ? 'Shared by default (family can view)' : 'Private upload'}</span>
          </label>
        </>
      )}
    </div>
  )
}
