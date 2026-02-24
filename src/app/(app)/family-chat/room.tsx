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
  toggleFamilyMessageReaction,
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
  reactionsByMessageId?: Record<string, Array<{ emoji: string; userId: string }>>
}

type UploadedAttachment = {
  storagePath: string
  mimeType: string
  previewUrl: string
}

const QUICK_REACTIONS = ['👍', '❤️', '😂'] as const

export function FamilyChatRoom({
  channel,
  messages: initialMessages,
  ownerNames,
  ownerAvatars,
  reactionsByMessageId: initialReactionsByMessageId,
}: Props) {
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
  const [replyingToMessageId, setReplyingToMessageId] = useState<string | null>(null)
  const [reactionsByMessageId, setReactionsByMessageId] = useState(
    initialReactionsByMessageId ?? {} as Record<string, Array<{ emoji: string; userId: string }>>
  )
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const initialScrolledForChannelRef = useRef<string | null>(null)
  const prevChannelIdRef = useRef<string | null>(null)
  const initialLoadedImageIdsRef = useRef<Set<string>>(new Set())
  const initialRevealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialPostRevealAnchorsRef = useRef<number[]>([])
  const postSendAnchorTimeoutsRef = useRef<number[]>([])
  const anchorTickerRef = useRef<number | null>(null)
  const initialAutoAnchorUntilRef = useRef<number>(0)
  const postSendAutoAnchorUntilRef = useRef<number>(0)
  const userTookScrollControlRef = useRef(false)
  const programmaticScrollRef = useRef(false)
  const suppressScrollEventsUntilRef = useRef<number>(0)
  const nearBottomRef = useRef(true)
  const pendingIncomingAutoScrollRef = useRef(false)
  const prevRenderedMessageCountRef = useRef(initialMessages.length)
  const prevRenderedLastMessageIdRef = useRef<string | null>(initialMessages.at(-1)?.id ?? null)

  const initialImageMessageIds = messages
    .filter((msg) => Boolean(msg.image_storage_path))
    .map((msg) => msg.id)

  function scrollMessagesToBottom() {
    if (!messagesRef.current) return
    programmaticScrollRef.current = true
    suppressScrollEventsUntilRef.current = Date.now() + 250
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
    nearBottomRef.current = true
    window.setTimeout(() => {
      programmaticScrollRef.current = false
    }, 120)
  }

  function stopAnchorTicker() {
    if (!anchorTickerRef.current) return
    clearInterval(anchorTickerRef.current)
    anchorTickerRef.current = null
  }

  function ensureAnchorTicker() {
    if (anchorTickerRef.current) return
    anchorTickerRef.current = window.setInterval(() => {
      const now = Date.now()
      const inInitialWindow = now <= initialAutoAnchorUntilRef.current
      const inPostSendWindow = now <= postSendAutoAnchorUntilRef.current
      if (userTookScrollControlRef.current || (!inInitialWindow && !inPostSendWindow)) {
        stopAnchorTicker()
        return
      }
      scrollMessagesToBottom()
    }, 120)
  }

  function revealAtBottom() {
    scrollMessagesToBottom()
    requestAnimationFrame(() => {
      scrollMessagesToBottom()
      initialAutoAnchorUntilRef.current = Math.max(initialAutoAnchorUntilRef.current, Date.now() + 6000)
      setInitialPositioned(true)
      schedulePostRevealAnchors()
      ensureAnchorTicker()
    })
  }

  function clearAnchorTimeouts(ref: React.MutableRefObject<number[]>) {
    for (const timeoutId of ref.current) {
      clearTimeout(timeoutId)
    }
    ref.current = []
  }

  function queueAnchorBursts(
    delays: number[],
    untilRef: React.MutableRefObject<number>,
    timeoutsRef: React.MutableRefObject<number[]>
  ) {
    for (const delay of delays) {
      const timeoutId = window.setTimeout(() => {
        if (userTookScrollControlRef.current) return
        if (Date.now() > untilRef.current) return
        scrollMessagesToBottom()
      }, delay)
      timeoutsRef.current.push(timeoutId)
    }
  }

  function schedulePostRevealAnchors() {
    clearAnchorTimeouts(initialPostRevealAnchorsRef)
    queueAnchorBursts([0, 40, 120, 260, 600, 1000, 1800, 3000, 4500], initialAutoAnchorUntilRef, initialPostRevealAnchorsRef)
  }

  function startAutoAnchorWindow(ms: number) {
    const until = Date.now() + ms
    initialAutoAnchorUntilRef.current = Math.max(initialAutoAnchorUntilRef.current, until)
    postSendAutoAnchorUntilRef.current = until
    userTookScrollControlRef.current = false
    ensureAnchorTicker()
    scrollMessagesToBottom()
    requestAnimationFrame(() => {
      scrollMessagesToBottom()
    })
    clearAnchorTimeouts(postSendAnchorTimeoutsRef)
    queueAnchorBursts([0, 40, 120, 260, 600, 1000, 1600], postSendAutoAnchorUntilRef, postSendAnchorTimeoutsRef)
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
    const nextLastMessageId = initialMessages.at(-1)?.id ?? null
    const isSameChannel = prevChannelIdRef.current === channel.id
    const hasNewMessages =
      isSameChannel &&
      (initialMessages.length > prevRenderedMessageCountRef.current ||
        (nextLastMessageId !== null && nextLastMessageId !== prevRenderedLastMessageIdRef.current))

    if (initialPositioned && hasNewMessages && nearBottomRef.current) {
      pendingIncomingAutoScrollRef.current = true
    }

    setMessages(initialMessages)
    if (!renaming && !savingName) {
      setDraftName(channel.name)
    }

    prevRenderedMessageCountRef.current = initialMessages.length
    prevRenderedLastMessageIdRef.current = nextLastMessageId
  }, [initialMessages, channel.id, channel.name, renaming, savingName])

  useEffect(() => {
    setReactionsByMessageId(initialReactionsByMessageId ?? {})
  }, [initialReactionsByMessageId, channel.id])

  useEffect(() => {
    if (prevChannelIdRef.current !== null && prevChannelIdRef.current !== channel.id) {
      initialScrolledForChannelRef.current = null
      initialLoadedImageIdsRef.current = new Set()
      setInitialPositioned(false)
    }
    initialAutoAnchorUntilRef.current = Date.now() + 5000
    userTookScrollControlRef.current = false
    clearAnchorTimeouts(initialPostRevealAnchorsRef)
    clearAnchorTimeouts(postSendAnchorTimeoutsRef)
    stopAnchorTicker()
    nearBottomRef.current = true
    pendingIncomingAutoScrollRef.current = false
    prevRenderedMessageCountRef.current = initialMessages.length
    prevRenderedLastMessageIdRef.current = initialMessages.at(-1)?.id ?? null
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
    if (!initialPositioned) return
    if (userTookScrollControlRef.current) return
    if (Date.now() > initialAutoAnchorUntilRef.current) return

    requestAnimationFrame(() => {
      if (userTookScrollControlRef.current) return
      if (Date.now() > initialAutoAnchorUntilRef.current) return
      scrollMessagesToBottom()
    })
  }, [imageUrls, messages.length, initialPositioned])

  useEffect(() => {
    if (!initialPositioned) return
    if (!pendingIncomingAutoScrollRef.current) return
    pendingIncomingAutoScrollRef.current = false
    startAutoAnchorWindow(1400)
  }, [messages.length, imageUrls, initialPositioned])

  useEffect(() => {
    const interval = window.setInterval(() => {
      router.refresh()
    }, 5000)
    return () => window.clearInterval(interval)
  }, [router])

  useEffect(() => {
    return () => {
      if (initialRevealTimeoutRef.current) {
        clearTimeout(initialRevealTimeoutRef.current)
      }
      for (const timeoutId of initialPostRevealAnchorsRef.current) {
        clearTimeout(timeoutId)
      }
      for (const timeoutId of postSendAnchorTimeoutsRef.current) {
        clearTimeout(timeoutId)
      }
      stopAnchorTicker()
    }
  }, [])

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
      replyToMessageId: replyingToMessageId,
    })
    setSending(false)

    if (result.success) {
      startAutoAnchorWindow(2500)
      setInput('')
      setAttachment(null)
      setUploadError('')
      setReplyingToMessageId(null)
      router.refresh()
    }
  }

  async function handleMessageDelete(id: string) {
    await deleteFamilyMessage(id)
    router.refresh()
  }

  async function handleToggleReaction(messageId: string, emoji: string) {
    const normalized = emoji.trim()
    if (!normalized) return
    setReactionsByMessageId((prev) => {
      const current = prev[messageId] ?? []
      const exists = current.some((r) => r.userId === profile.userId && r.emoji === normalized)
      const nextRows = exists
        ? current.filter((r) => !(r.userId === profile.userId && r.emoji === normalized))
        : [...current, { emoji: normalized, userId: profile.userId }]
      return { ...prev, [messageId]: nextRows }
    })
    const result = await toggleFamilyMessageReaction({ channelId: channel.id, messageId, emoji: normalized })
    if (!result.success) {
      router.refresh()
    }
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
    if (!userTookScrollControlRef.current && Date.now() <= initialAutoAnchorUntilRef.current) {
      scrollMessagesToBottom()
    }
    if (initialPositioned) return
    initialLoadedImageIdsRef.current.add(messageId)
    if (initialImageMessageIds.every((id) => initialLoadedImageIdsRef.current.has(id))) {
      revealAtBottom()
    }
  }

  function handleMessagesScroll() {
    if (!initialPositioned) return
    if (messagesRef.current) {
      const distanceFromBottom =
        messagesRef.current.scrollHeight - messagesRef.current.scrollTop - messagesRef.current.clientHeight
      nearBottomRef.current = distanceFromBottom <= 80
    }
    if (programmaticScrollRef.current) return
    if (Date.now() <= suppressScrollEventsUntilRef.current) return
    userTookScrollControlRef.current = true
    stopAnchorTicker()
  }

  function getReactionGroups(messageId: string) {
    const rows = reactionsByMessageId[messageId] ?? []
    const grouped = new Map<string, { emoji: string; count: number; reactedByMe: boolean }>()
    for (const row of rows) {
      const existing = grouped.get(row.emoji)
      if (existing) {
        existing.count += 1
        if (row.userId === profile.userId) existing.reactedByMe = true
      } else {
        grouped.set(row.emoji, {
          emoji: row.emoji,
          count: 1,
          reactedByMe: row.userId === profile.userId,
        })
      }
    }
    return Array.from(grouped.values()).sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))
  }

  const messageMap = new Map(messages.map((m) => [m.id, m]))

  function getReplyPreview(messageId: string | null) {
    if (!messageId) return null
    return messageMap.get(messageId) ?? null
  }

  function getMessageSnippet(message: FamilyMessageRow | null) {
    if (!message) return 'Original message unavailable'
    if (message.content?.trim()) return message.content.trim()
    if (message.image_storage_path) return 'Image'
    return 'Message'
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
          onScroll={handleMessagesScroll}
          style={{ visibility: hydrated && initialPositioned ? 'visible' : 'hidden' }}
        >
          {messages.map((msg) => {
            const reactionGroups = getReactionGroups(msg.id)
            return (
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
                {msg.reply_to_message_id && (
                  <button
                    type="button"
                    className={styles.replyPreview}
                    onClick={() => setReplyingToMessageId(msg.reply_to_message_id)}
                    title="Reply to this reply target"
                  >
                    <span className={styles.replyPreviewLabel}>Replying to</span>
                    <span className={styles.replyPreviewText}>{getMessageSnippet(getReplyPreview(msg.reply_to_message_id))}</span>
                  </button>
                )}
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
                {reactionGroups.length > 0 && (
                  <div className={styles.reactionRow}>
                    {reactionGroups.map((reaction) => (
                      <button
                        key={`${msg.id}-${reaction.emoji}`}
                        type="button"
                        className={`${styles.reactionChip} ${reaction.reactedByMe ? styles.reactionChipActive : ''}`}
                        onClick={() => void handleToggleReaction(msg.id, reaction.emoji)}
                        title={reaction.reactedByMe ? 'Remove reaction' : 'React'}
                      >
                        <span>{reaction.emoji}</span>
                        <span className={styles.reactionCount}>{reaction.count}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className={styles.reactionActions}>
                  <button
                    type="button"
                    className={styles.quickReactionBtn}
                    onClick={() => setReplyingToMessageId(msg.id)}
                    title="Reply"
                    aria-label="Reply to message"
                  >
                    ↩️
                  </button>
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={`${msg.id}-quick-${emoji}`}
                      type="button"
                      className={styles.quickReactionBtn}
                      onClick={() => void handleToggleReaction(msg.id, emoji)}
                      title={`React ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                  <EmojiPickerButton
                    onSelect={(emoji) => { void handleToggleReaction(msg.id, emoji) }}
                    disabled={sending}
                    title="More reactions"
                    compact
                    triggerContent="➕"
                    panelAlign="right"
                  />
                </div>
              </div>
            </div>
            )
          })}
          <div ref={messagesEndRef} aria-hidden="true" />
        </div>
      </div>

      <form className={styles.composer} onSubmit={handleSubmit}>
        {replyingToMessageId && (
          <div className={styles.replyComposerBar}>
            <div className={styles.replyComposerText}>
              <span className={styles.replyComposerLabel}>Replying to</span>
              <span className={styles.replyComposerSnippet}>
                {getMessageSnippet(getReplyPreview(replyingToMessageId))}
              </span>
            </div>
            <button
              type="button"
              className={styles.replyComposerClear}
              onClick={() => setReplyingToMessageId(null)}
              aria-label="Cancel reply"
            >
              &times;
            </button>
          </div>
        )}
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
