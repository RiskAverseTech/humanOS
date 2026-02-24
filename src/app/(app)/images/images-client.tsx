'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProfile } from '@/components/providers/profile-provider'
import { getImageUrl, deleteGeneratedImage, type GeneratedImageRow } from './actions'
import styles from './images-client.module.css'

type ImagesClientProps = {
  images: GeneratedImageRow[]
  ownerNames: Record<string, string>
}

export function ImagesClient({ images, ownerNames }: ImagesClientProps) {
  const router = useRouter()
  const profile = useProfile()
  const [mode, setMode] = useState<'generate' | 'edit'>('generate')
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState<'1024x1024' | '1024x1536' | '1536x1024'>('1024x1024')
  const [imageModel, setImageModel] = useState<'gpt-image-1.5' | 'grok-imagine-image'>('gpt-image-1.5')
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [selectedImage, setSelectedImage] = useState<GeneratedImageRow | null>(null)
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [editSource, setEditSource] = useState<GeneratedImageRow | null>(null)
  const [editUploadFile, setEditUploadFile] = useState<File | null>(null)
  const [editUploadPreviewUrl, setEditUploadPreviewUrl] = useState<string | null>(null)
  const editUploadInputRef = useRef<HTMLInputElement>(null)
  const lightboxTouchStartXRef = useRef<number | null>(null)

  // Load signed URLs for gallery thumbnails
  useEffect(() => {
    async function loadUrls() {
      const urls: Record<string, string> = {}
      for (const img of images.slice(0, 20)) {
        const url = await getImageUrl(img.storage_path)
        if (url) urls[img.id] = url
      }
      setImageUrls(urls)
    }
    loadUrls()
  }, [images])

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!prompt.trim() || generating) return
    if (mode === 'edit' && !editSource && !editUploadFile) {
      setError('Choose an existing image or upload one to edit first.')
      return
    }

    setGenerating(true)
    setError('')

    try {
      const res = await (async () => {
        if (mode === 'edit' && editUploadFile) {
          const formData = new FormData()
          formData.append('mode', 'edit')
          formData.append('prompt', prompt.trim())
          formData.append('size', size)
          formData.append('model', imageModel)
          formData.append('image', editUploadFile, editUploadFile.name || 'edit-source.png')
          return fetch('/api/images', {
            method: 'POST',
            body: formData,
          })
        }

        return fetch('/api/images', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode,
            prompt: prompt.trim(),
            size,
            model: imageModel,
            sourceStoragePath: editSource?.storage_path,
          }),
        })
      })()

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Generation failed')
        return
      }

      setPrompt('')
      if (mode === 'edit') {
        setMode('generate')
        setEditSource(null)
        setEditUploadFile(null)
        setEditUploadPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return null
        })
      }
      router.refresh()
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleViewImage(image: GeneratedImageRow) {
    setSelectedImage(image)
    const url = imageUrls[image.id] || (await getImageUrl(image.storage_path))
    setSelectedUrl(url)
  }

  async function openImageByIndex(index: number) {
    const next = images[index]
    if (!next) return
    setSelectedImage(next)
    const url = imageUrls[next.id] || (await getImageUrl(next.storage_path))
    setSelectedUrl(url)
  }

  async function navigateSelected(delta: number) {
    if (!selectedImage || images.length <= 1) return
    const currentIndex = images.findIndex((img) => img.id === selectedImage.id)
    if (currentIndex < 0) return
    const nextIndex = (currentIndex + delta + images.length) % images.length
    await openImageByIndex(nextIndex)
  }

  async function handleDelete(image: GeneratedImageRow) {
    if (!confirm('Delete this image?')) return
    await deleteGeneratedImage(image.id, image.storage_path)
    setSelectedImage(null)
    router.refresh()
  }

  function handleStartEdit(image: GeneratedImageRow) {
    setEditSource(image)
    if (editUploadPreviewUrl) URL.revokeObjectURL(editUploadPreviewUrl)
    setEditUploadFile(null)
    setEditUploadPreviewUrl(null)
    setMode('edit')
    setPrompt(image.prompt)
    setSelectedImage(null)
    setSelectedUrl(null)
    setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleCancelEditMode() {
    setMode('generate')
    setEditSource(null)
    if (editUploadPreviewUrl) URL.revokeObjectURL(editUploadPreviewUrl)
    setEditUploadFile(null)
    setEditUploadPreviewUrl(null)
    setError('')
  }

  function handleEditUploadChange(e: React.ChangeEvent<HTMLInputElement>) {
    const inputEl = e.currentTarget
    const file = inputEl.files?.[0]
    inputEl.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file to edit.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Edit source image must be 10MB or smaller.')
      return
    }

    if (editUploadPreviewUrl) URL.revokeObjectURL(editUploadPreviewUrl)
    setEditUploadFile(file)
    setEditUploadPreviewUrl(URL.createObjectURL(file))
    setEditSource(null)
    setMode('edit')
    setError('')
  }

  useEffect(() => {
    return () => {
      if (editUploadPreviewUrl) URL.revokeObjectURL(editUploadPreviewUrl)
    }
  }, [editUploadPreviewUrl])

  useEffect(() => {
    if (!selectedImage) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        void navigateSelected(-1)
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        void navigateSelected(1)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedImage, images, imageUrls])

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Image Generation</h1>

      {/* Generation form */}
      <form onSubmit={handleGenerate} className={styles.form}>
        <div className={styles.modeTabs}>
          <button
            type="button"
            className={`${styles.modeTab} ${mode === 'generate' ? styles.modeTabActive : ''}`}
            onClick={() => setMode('generate')}
            disabled={generating}
          >
            Generate
          </button>
          <button
            type="button"
            className={`${styles.modeTab} ${mode === 'edit' ? styles.modeTabActive : ''}`}
            onClick={() => {
              setMode('edit')
              if (imageModel === 'grok-imagine-image') setImageModel('gpt-image-1.5')
            }}
            disabled={generating}
          >
            Edit Existing
          </button>
        </div>

        <div className={styles.formMeta}>
          <span className={styles.modelBadge}>Model</span>
          <select
            className={styles.sizeSelect}
            value={imageModel}
            onChange={(e) => setImageModel(e.target.value as typeof imageModel)}
            disabled={generating}
            aria-label="Image model"
          >
            <option value="gpt-image-1.5">GPT Image 1.5</option>
            <option value="grok-imagine-image">Grok Imagine</option>
          </select>
          {mode === 'edit' && (
            <span className={styles.editHint}>
              {editSource
                ? `Editing: ${editSource.prompt}`
                : editUploadFile
                  ? `Editing uploaded image: ${editUploadFile.name}`
                  : 'Pick an image from the gallery or upload one to edit. (Edit mode uses GPT Image)'}
            </span>
          )}
        </div>

        {mode === 'edit' && (
          <div className={styles.editToolsRow}>
            <button
              type="button"
              className={styles.uploadEditBtn}
              onClick={() => editUploadInputRef.current?.click()}
              disabled={generating}
            >
              Upload image to edit
            </button>
            <input
              ref={editUploadInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className={styles.hiddenFileInput}
              onChange={handleEditUploadChange}
              disabled={generating}
            />
          </div>
        )}

        {mode === 'edit' && (editSource || editUploadFile) && (
          <div className={styles.editSourceCard}>
            <div className={styles.editSourceThumb}>
              {editUploadPreviewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={editUploadPreviewUrl} alt="Uploaded edit source" className={styles.editSourceThumbImage} />
              ) : editSource && imageUrls[editSource.id] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={imageUrls[editSource.id]} alt={editSource.prompt} className={styles.editSourceThumbImage} />
              ) : (
                <span>🎨</span>
              )}
            </div>
            <div className={styles.editSourceInfo}>
              <span className={styles.editSourceLabel}>Source image</span>
              <span className={styles.editSourcePrompt}>
                {editUploadFile ? editUploadFile.name : editSource?.prompt}
              </span>
            </div>
            <button
              type="button"
              className={styles.clearEditBtn}
              onClick={handleCancelEditMode}
              disabled={generating}
            >
              Clear
            </button>
          </div>
        )}

        <div className={styles.inputRow}>
          <input
            type="text"
            className={styles.promptInput}
            placeholder={
              mode === 'edit'
                ? 'Describe how to edit the selected image...'
                : 'Describe the image you want to create...'
            }
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={generating}
          />
          <select
            className={styles.sizeSelect}
            value={size}
            onChange={(e) => setSize(e.target.value as typeof size)}
            disabled={generating}
          >
            <option value="1024x1024">Square</option>
            <option value="1024x1536">Portrait</option>
            <option value="1536x1024">Landscape</option>
          </select>
          <button type="submit" className={styles.generateButton} disabled={!prompt.trim() || generating}>
            {generating ? (mode === 'edit' ? 'Editing...' : 'Generating...') : mode === 'edit' ? 'Apply Edit' : 'Generate'}
          </button>
        </div>
        {error && <p className={styles.error}>{error}</p>}
      </form>

      {/* Gallery */}
      {images.length === 0 ? (
        <div className={styles.empty}>
          <span className={styles.emptyIcon}>🎨</span>
          <p>No images generated yet. Try creating one above!</p>
        </div>
      ) : (
        <div className={styles.gallery}>
          {images.map((image) => (
            <div
              key={image.id}
              className={styles.card}
              onClick={() => handleViewImage(image)}
            >
              {imageUrls[image.id] ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={imageUrls[image.id]}
                  alt={image.prompt}
                  className={styles.thumbnail}
                />
              ) : (
                <div className={styles.placeholder}>🎨</div>
              )}
              <p className={styles.cardPrompt}>{image.prompt}</p>
              <p className={styles.cardMeta}>
                By {ownerNames[image.owner_id] ?? 'Unknown'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedImage && (
        <div className={styles.overlay} onClick={() => setSelectedImage(null)}>
          <div className={styles.lightbox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.lightboxHeader}>
              <p className={styles.lightboxPrompt}>{selectedImage.prompt}</p>
              <div className={styles.lightboxActions}>
                {selectedUrl && (
                  <a
                    href={selectedUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.downloadBtn}
                  >
                    Download
                  </a>
                )}
                {selectedImage.owner_id === profile.userId && (
                  <button className={styles.deleteBtn} onClick={() => handleDelete(selectedImage)}>
                    Delete
                  </button>
                )}
                <button className={styles.editBtn} onClick={() => handleStartEdit(selectedImage)}>
                  Edit this image
                </button>
                <button className={styles.closeBtn} onClick={() => setSelectedImage(null)}>
                  &times;
                </button>
              </div>
            </div>
            <div
              className={styles.lightboxImageWrap}
              onTouchStart={(e) => {
                lightboxTouchStartXRef.current = e.changedTouches[0]?.clientX ?? null
              }}
              onTouchEnd={(e) => {
                const startX = lightboxTouchStartXRef.current
                const endX = e.changedTouches[0]?.clientX ?? null
                lightboxTouchStartXRef.current = null
                if (startX == null || endX == null) return
                const dx = endX - startX
                if (Math.abs(dx) < 40) return
                void navigateSelected(dx < 0 ? 1 : -1)
              }}
            >
              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    className={`${styles.lightboxNavBtn} ${styles.lightboxNavPrev}`}
                    onClick={() => void navigateSelected(-1)}
                    aria-label="Previous image"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className={`${styles.lightboxNavBtn} ${styles.lightboxNavNext}`}
                    onClick={() => void navigateSelected(1)}
                    aria-label="Next image"
                  >
                    ›
                  </button>
                </>
              )}
              {selectedUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={selectedUrl} alt={selectedImage.prompt} className={styles.lightboxImage} />
              ) : (
                <p className={styles.loading}>Loading...</p>
              )}
            </div>
            <div className={styles.lightboxMeta}>
              <span>{selectedImage.model}</span>
              <span>By {ownerNames[selectedImage.owner_id] ?? 'Unknown'}</span>
              <span>
                {new Date(selectedImage.created_at).toLocaleDateString('en-AU', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
              {images.length > 1 && (
                <span>
                  {images.findIndex((img) => img.id === selectedImage.id) + 1} / {images.length}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
