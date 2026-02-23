'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import { useProfile } from '@/components/providers/profile-provider'
import {
  deleteFamilyMessage,
  getFamilyChatUploadUrl,
  postFamilyMessage,
  renameFamilyChannel,
  type FamilyChannelRow,
  type FamilyMessageRow,
} from './actions'
import styles from './room.module.css'

type Props = {
  channel: FamilyChannelRow
  messages: FamilyMessageRow[]
  ownerNames: Record<string, string>
}

type UploadedAttachment = {
  storagePath: string
  mimeType: string
  previewUrl: string
}

export function FamilyChatRoom({ channel, messages: initialMessages, ownerNames }: Props) {
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(initialMessages)
    if (!renaming && !savingName) {
      setDraftName(channel.name)
    }
  }, [initialMessages, channel.id, channel.name, renaming, savingName])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

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

      <div className={styles.messages}>
        {messages.map((msg) => (
          <div key={msg.id} className={styles.messageRow}>
            <div className={styles.avatar}>{(ownerNames[msg.author_id] ?? '?').charAt(0).toUpperCase()}</div>
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
                <img src={imageUrls[msg.id]} alt="Chat upload" className={styles.messageImage} />
              )}
            </div>
          </div>
        ))}
        <div ref={endRef} />
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
          <button
            type="button"
            className={styles.attachBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage || sending}
            title="Upload image"
          >
            {uploadingImage ? '...' : '📎'}
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
            className={styles.textarea}
            value={input}
            onChange={(e) => setInput(e.target.value)}
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
    </div>
  )
}
