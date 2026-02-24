'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useProfile } from '@/components/providers/profile-provider'
import { EmojiPickerButton } from '@/components/ui/emoji-picker'
import {
  copyGeneratedImageToFamilyChatUpload,
  deleteFamilyMessage,
  getGeneratedImagesForFamilyChatPicker,
  getFamilyChatUploadUrl,
  postFamilyMessage,
  renameFamilyChannel,
  type FamilyGeneratedImagePickerItem,
  type FamilyChannelRow,
  type FamilyMessageRow,
} from './actions'
import styles from './room.module.css'

type Props = {
  channel: FamilyChannelRow
  messages: FamilyMessageRow[]
  ownerNames: Record<string, string>
  ownerAvatars?: Record<string, string | null>
}

type UploadedAttachment = {
  storagePath: string
  mimeType: string
  previewUrl: string
}

export function FamilyChatRoom({ channel, messages: initialMessages, ownerNames, ownerAvatars }: Props) {
  const profile = useProfile()
  const router = useRouter()
  const [messages, setMessages] = useState(initialMessages)
  const [input, setInput] = useState('')
  const [draftName, setDraftName] = useState(channel.name)
  const [renaming, setRenaming] = useState(false)
  const [savingName, setSavingName] = useState(false)
  const [sending, setSending] = useState(false)
  const [attachment, setAttachment] = useState<UploadedAttachment | null>(null)
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({})
  const [uploadingImage, setUploadingImage] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({})
  const [hydrated, setHydrated] = useState(false)
  const [initialPositioned, setInitialPositioned] = useState(false)
  const [showGeneratedPicker, setShowGeneratedPicker] = useState(false)
  const [generatedPickerLoading, setGeneratedPickerLoading] = useState(false)
  const [generatedPickerError, setGeneratedPickerError] = useState('')
  const [generatedPickerItems, setGeneratedPickerItems] = useState<FamilyGeneratedImagePickerItem[]>([])
  const [selectingGeneratedImageId, setSelectingGeneratedImageId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const initialScrolledForChannelRef = useRef<string | null>(null)
  const prevChannelIdRef = useRef<string | null>(null)
  const initialLoadedImageIdsRef = useRef<Set<string>>(new Set())
  const initialRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const initialImageMessageIds = messages
    .filter((msg) => Boolean(msg.image_storage_path))
    .map((msg) => msg.id)

  function scrollMessagesToBottom() {
    if (!messagesRef.current) return
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }

  function revealAtBottom() {
    scrollMessagesToBottom()
    requestAnimationFrame(() => {
      scrollMessagesToBottom()
      setInitialPositioned(true)
    })
  }

  useEffect(() => {
    setHydrated(true)
  }, [])

  // Load signed avatar URLs
  useEffect(() => {
    let active = true
    async function loadAvatars() {
      if (!ownerAvatars) return
      const supabase = createBrowserSupabaseClient()
      const resolved: Record<string, string> = {}
      for (const [userId, raw] of Object.entries(ownerAvatars)) {
        if (!raw) continue
        if (/^https?:\/\//i.test(raw)) {
          resolved[userId] = raw
        } else {
          const { data } = await supabase.storage.from('avatars').createSignedUrl(raw, 3600)
          if (data?.signedUrl) resolved[userId] = data.signedUrl
        }
      }
      if (active) setAvatarUrls(resolved)
    }
    void loadAvatars()
    return () => { active = false }
  }, [ownerAvatars])

  useEffect(() => {
    setMessages(initialMessages)
    if (!renaming && !savingName) {
      setDraftName(channel.name)
    }
  }, [initialMessages, channel.id, channel.name, renaming, savingName])

  useEffect(() => {
    if (prevChannelIdRef.current !== null && prevChannelIdRef.current !== channel.id) {
      initialScrolledForChannelRef.current = null
      initialLoadedImageIdsRef.current = new Set()
      setInitialPositioned(false)
    }
    prevChannelIdRef.current = channel.id
  }, [channel.id])

  useEffect(() => {
    let active = true
    async function loadUrls() {
      const next: Record<string, string> = {}
      for (const msg of initialMessages) {
        if (!msg.image_storage_path) continue
        const signed = await getFamilyChatUploadUrl(msg.image_storage_path)
        if (signed) next[msg.id] = signed
      }
      if (active) setImageUrls(next)
    }
    void loadUrls()
    return () => {
      active = false
    }
  }, [initialMessages])

  useLayoutEffect(() => {
    if (!messagesRef.current) return
    if (initialPositioned && initialScrolledForChannelRef.current === channel.id) return
    scrollMessagesToBottom()
    initialScrolledForChannelRef.current = channel.id
  }, [channel.id, messages.length, imageUrls, initialPositioned])

  useEffect(() => {
    if (initialPositioned) return

    if (initialRevealTimeoutRef.current) {
      clearTimeout(initialRevealTimeoutRef.current)
    }

    const canRevealWithoutImages = initialImageMessageIds.length === 0
    const allInitialImagesLoaded = initialImageMessageIds.every((id) => initialLoadedImageIdsRef.current.has(id))

    if (canRevealWithoutImages || allInitialImagesLoaded) {
      revealAtBottom()
      return
    }

    // Fallback so a broken/slow image does not block the chat forever.
    initialRevealTimeoutRef.current = setTimeout(() => {
      revealAtBottom()
    }, 1800)

    return () => {
      if (initialRevealTimeoutRef.current) {
        clearTimeout(initialRevealTimeoutRef.current)
        initialRevealTimeoutRef.current = null
      }
    }
  }, [channel.id, initialPositioned, initialImageMessageIds, imageUrls])

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh()
    }, 5000)
    return () => window.clearInterval(interval)
  }, [router])

  async function handleRename() {
    const next = draftName.trim()
    if (!next || next === channel.name) {
      setRenaming(false)
      setDraftName(channel.name)
      return
    }
    setSavingName(true)
    const result = await renameFamilyChannel(channel.id, next)
    setSavingName(false)
    if (result.success) {
      setRenaming(false)
      setDraftName(next)
      router.refresh()
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if ((!input.trim() && !attachment) || sending) return

    setSending(true)
    const result = await postFamilyMessage({
      channelId: channel.id,
      content: input,
      imageStoragePath: attachment?.storagePath,
      imageMimeType: attachment?.mimeType,
    })
    setSending(false)

    if (result.success) {
      setInput('')
      setAttachment(null)
      setUploadError('')
      router.refresh()
    }
  }

  async function handleMessageDelete(id: string) {
    await deleteFamilyMessage(id)
    router.refresh()
  }

  async function uploadChatImage(file: File) {
    if (!file.type.startsWith('image/')) {
      setUploadError('Only image uploads are supported in regular chat right now.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Image must be 10MB or smaller.')
      return
    }

    setUploadingImage(true)
    setUploadError('')
    try {
      const supabase = createBrowserSupabaseClient()
      const ext = file.name.split('.').pop() || 'png'
      const storagePath = `${profile.userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage
        .from('chat-uploads')
        .upload(storagePath, file, { cacheControl: '3600', upsert: false })

      if (error) throw new Error(error.message)

      const previewUrl = URL.createObjectURL(file)
      setAttachment({
        storagePath,
        mimeType: file.type || 'image/png',
        previewUrl,
      })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploadingImage(false)
    }
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const file = Array.from(e.clipboardData.items)
      .map((item) => (item.kind === 'file' ? item.getAsFile() : null))
      .find((f): f is File => Boolean(f && f.type.startsWith('image/')))

    if (!file) return
    e.preventDefault()
    await uploadChatImage(file)
  }

  async function openGeneratedImagePicker() {
    setShowGeneratedPicker(true)
    if (generatedPickerItems.length > 0 || generatedPickerLoading) return
    setGeneratedPickerLoading(true)
    setGeneratedPickerError('')
    try {
      const items = await getGeneratedImagesForFamilyChatPicker(24)
      setGeneratedPickerItems(items)
    } catch {
      setGeneratedPickerError('Could not load generated images.')
    } finally {
      setGeneratedPickerLoading(false)
    }
  }

  async function handleSelectGeneratedImage(imageId: string) {
    setSelectingGeneratedImageId(imageId)
    setGeneratedPickerError('')
    const result = await copyGeneratedImageToFamilyChatUpload(imageId)
    setSelectingGeneratedImageId(null)
    if (!result.success || !result.attachment) {
      setGeneratedPickerError(result.error || 'Could not attach selected image.')
      return
    }
    setAttachment(result.attachment)
    setShowGeneratedPicker(false)
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current
    if (!el) {
      setInput((prev) => `${prev}${emoji}`)
      return
    }
    const start = el.selectionStart ?? input.length
    const end = el.selectionEnd ?? input.length
    const next = input.slice(0, start) + emoji + input.slice(end)
    setInput(next)
    requestAnimationFrame(() => {
      el.focus()
      const pos = start + emoji.length
      el.setSelectionRange(pos, pos)
    })
  }

  function handleComposerKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if ((!input.trim() && !attachment) || sending) return
      void handleSubmit(e)
    }
  }

  function handleInitialMessageImageReady(messageId: string) {
    if (initialPositioned) return
    scrollMessagesToBottom()
    initialLoadedImageIdsRef.current.add(messageId)
    if (initialImageMessageIds.every((id) => initialLoadedImageIdsRef.current.has(id))) {
      revealAtBottom()
    }
  }

  return (
    <div className={styles.room}>
      <div className={styles.header}>
        <div className={styles.headerMain}>
          <span className={styles.hash}>#</span>
          {renaming && channel.owner_id === profile.userId ? (
            <>
              <input
                className={styles.renameInput}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleRename()
                  }
                  if (e.key === 'Escape') {
                    setRenaming(false)
                    setDraftName(channel.name)
                  }
                }}
                autoFocus
              />
              <button className={styles.headerBtn} onClick={() => void handleRename()} disabled={savingName}>
                {savingName ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              <h1 className={styles.title}>{channel.name}</h1>
              {channel.owner_id === profile.userId && (
                <button className={styles.headerGhostBtn} onClick={() => setRenaming(true)}>
                  Rename
                </button>
              )}
            </>
          )}
        </div>
        <div className={styles.headerMeta}>
          <span>Owner: {ownerNames[channel.owner_id] ?? 'Unknown'}</span>
          <span>{messages.length} messages</span>
        </div>
      </div>

      <div className={styles.messagesShell}>
        {!(hydrated && initialPositioned) && (
          <div className={styles.initialLoadingOverlay} aria-live="polite">
            <div className={styles.initialLoadingCard}>
              <div className={styles.initialLoadingSpinner} />
              <div className={styles.initialLoadingText}>
                <strong>Loading latest messages…</strong>
                <span>Jumping to the bottom of this channel</span>
              </div>
            </div>
          </div>
        )}

        <div
          className={styles.messages}
          ref={messagesRef}
          style={{ visibility: hydrated && initialPositioned ? 'visible' : 'hidden' }}
        >
          {messages.map((msg) => (
            <div key={msg.id} className={styles.messageRow}>
              <div className={styles.avatar}>
                {avatarUrls[msg.author_id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrls[msg.author_id]} alt="" className={styles.avatarImg} />
                ) : (
                  (ownerNames[msg.author_id] ?? '?').charAt(0).toUpperCase()
                )}
              </div>
              <div className={styles.messageBody}>
                <div className={styles.messageMeta}>
                  <span className={styles.author}>{ownerNames[msg.author_id] ?? 'Unknown'}</span>
                  <span className={styles.timestamp}>
                    {new Date(msg.created_at).toLocaleString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {msg.author_id === profile.userId && (
                    <button className={styles.deleteMsgBtn} onClick={() => void handleMessageDelete(msg.id)}>
                      delete
                    </button>
                  )}
                </div>
                {msg.content && <p className={styles.messageText}>{msg.content}</p>}
                {msg.image_storage_path && imageUrls[msg.id] && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={imageUrls[msg.id]}
                    alt="Chat upload"
                    className={styles.messageImage}
                    onLoad={() => handleInitialMessageImageReady(msg.id)}
                    onError={() => handleInitialMessageImageReady(msg.id)}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <form className={styles.composer} onSubmit={handleSubmit}>
        {attachment && (
          <div className={styles.attachmentPreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={attachment.previewUrl} alt="Upload preview" className={styles.attachmentThumb} />
            <button
              type="button"
              className={styles.removeAttachmentBtn}
              onClick={() => setAttachment(null)}
            >
              Remove image
            </button>
          </div>
        )}

        <div className={styles.composerRow}>
          <EmojiPickerButton onSelect={insertEmoji} disabled={sending} title="Add emoji to human chat" />
          <button
            type="button"
            className={styles.attachBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage || sending}
            title="Upload image"
          >
            {uploadingImage ? '...' : '📎'}
          </button>
          <button
            type="button"
            className={styles.attachBtn}
            onClick={() => void openGeneratedImagePicker()}
            disabled={sending || uploadingImage}
            title="Use image from Images gallery"
          >
            🖼️
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            onChange={async (e) => {
              const inputEl = e.currentTarget
              const file = e.target.files?.[0]
              if (file) await uploadChatImage(file)
              inputEl.value = ''
            }}
          />

          <textarea
            ref={textareaRef}
            className={styles.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleComposerKeyDown}
            onPaste={handlePaste}
            placeholder="Message the family... (paste image or upload, emojis work 🙂)"
            rows={2}
            disabled={sending}
          />

          <button
            type="submit"
            className={styles.sendBtn}
            disabled={sending || (!input.trim() && !attachment)}
          >
            {sending ? 'Sending...' : 'Send'}
          </button>
        </div>
        {uploadError && <p className={styles.error}>{uploadError}</p>}
      </form>

      {showGeneratedPicker && (
        <div className={styles.pickerOverlay} onClick={() => setShowGeneratedPicker(false)}>
          <div className={styles.pickerModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.pickerHeader}>
              <h3 className={styles.pickerTitle}>Choose from Images</h3>
              <button className={styles.pickerCloseBtn} onClick={() => setShowGeneratedPicker(false)} aria-label="Close">
                &times;
              </button>
            </div>
            {generatedPickerLoading ? (
              <p className={styles.pickerEmpty}>Loading images...</p>
            ) : generatedPickerItems.length === 0 ? (
              <p className={styles.pickerEmpty}>No generated images found yet.</p>
            ) : (
              <div className={styles.pickerGrid}>
                {generatedPickerItems.map((img) => (
                  <button
                    key={img.id}
                    type="button"
                    className={styles.pickerCard}
                    onClick={() => void handleSelectGeneratedImage(img.id)}
                    disabled={selectingGeneratedImageId === img.id}
                    title={img.prompt}
                  >
                    {img.preview_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={img.preview_url} alt={img.prompt} className={styles.pickerThumb} />
                    ) : (
                      <div className={styles.pickerThumbFallback}>🎨</div>
                    )}
                    <span className={styles.pickerCardPrompt}>
                      {selectingGeneratedImageId === img.id ? 'Attaching...' : img.prompt}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {generatedPickerError && <p className={styles.error}>{generatedPickerError}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
