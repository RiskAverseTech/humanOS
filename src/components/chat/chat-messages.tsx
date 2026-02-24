'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useProfile } from '@/components/providers/profile-provider'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import { getAvailableModels } from '@/lib/ai/prompts'
import { EmojiPickerButton } from '@/components/ui/emoji-picker'
import type { MessageRow, ThreadRow } from '@/app/(app)/chat/actions'
import { updateThread, deleteThread } from '@/app/(app)/chat/actions'
import { useRouter } from 'next/navigation'
import styles from './chat-messages.module.css'

type ChatMessagesProps = {
  thread: ThreadRow
  initialMessages: MessageRow[]
  threadOwnerName?: string
  memberNames?: Record<string, string>
  memberAvatars?: Record<string, string | null>
}

export function ChatMessages({
  thread,
  initialMessages,
  threadOwnerName,
  memberNames,
  memberAvatars,
}: ChatMessagesProps) {
  const profile = useProfile()
  const router = useRouter()
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [title, setTitle] = useState(thread.title)
  const [draftTitle, setDraftTitle] = useState(thread.title)
  const [isRenaming, setIsRenaming] = useState(false)
  const [savingTitle, setSavingTitle] = useState(false)
  const [isShared, setIsShared] = useState(thread.is_shared)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [avatarUrls, setAvatarUrls] = useState<Record<string, string>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const initialScrolledThreadRef = useRef<string | null>(null)

  const models = getAvailableModels(profile.role)

  const aiDisplayName = getAiDisplayName(thread.model)

  // Load avatar signed URLs
  useEffect(() => {
    let active = true
    async function loadAvatars() {
      if (!memberAvatars) return
      const supabase = createBrowserSupabaseClient()
      const resolved: Record<string, string> = {}
      for (const [userId, raw] of Object.entries(memberAvatars)) {
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
  }, [memberAvatars])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText, scrollToBottom])

  useEffect(() => {
    initialScrolledThreadRef.current = null
  }, [thread.id])

  useEffect(() => {
    if (!messagesRef.current) return
    if (initialScrolledThreadRef.current === thread.id) return
    messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    initialScrolledThreadRef.current = thread.id
  }, [thread.id, messages.length, avatarUrls])

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  useEffect(() => {
    setTitle(thread.title)
    if (!isRenaming && !savingTitle) {
      setDraftTitle(thread.title)
    }
    if (!savingTitle) {
      setIsRenaming(false)
    }
    setIsShared(thread.is_shared)
  }, [thread.id, thread.title, thread.is_shared, isRenaming, savingTitle])

  useEffect(() => {
    try {
      window.localStorage.setItem('last_ai_chat_thread_id', thread.id)
    } catch {
      // ignore storage errors
    }
  }, [thread.id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || streaming) return

    const userMessage = input.trim()
    setInput('')
    setStreaming(true)
    setStreamingText('')

    // Optimistically add user message
    const tempUserMsg: MessageRow = {
      id: `temp-${Date.now()}`,
      thread_id: thread.id,
      role: 'user',
      content: userMessage,
      sender_id: profile.userId,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId: thread.id,
          message: userMessage,
          model: thread.model,
        }),
      })

      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        throw new Error(errText || `Chat failed: ${res.status}`)
      }

      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream reader')

      const decoder = new TextDecoder()
      let fullText = ''
      let streamError: string | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6)

          try {
            const data = JSON.parse(jsonStr)

            if (data.error) {
              streamError = data.error
              console.error('Stream error:', data.error)
              break
            }

            if (data.done) break

            if (data.text) {
              fullText += data.text
              setStreamingText(fullText)
            }
          } catch {
            // Skip malformed JSON
          }
        }

        if (streamError) break
      }

      if (streamError) {
        throw new Error(streamError)
      }

      // Replace streaming text with final message
      const assistantMsg: MessageRow = {
        id: `temp-assistant-${Date.now()}`,
        thread_id: thread.id,
        role: 'assistant',
        content: fullText,
        sender_id: null,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
      setStreamingText('')

      // Auto-title: if this is the first message, update the thread title
      if (messages.length === 0) {
        const titleSnippet = userMessage.slice(0, 60) + (userMessage.length > 60 ? '...' : '')
        await updateThread(thread.id, { title: titleSnippet })
        setTitle(titleSnippet)
        setDraftTitle(titleSnippet)
      }
    } catch (error) {
      console.error('Chat error:', error)
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Sorry, something went wrong. Please try again.'
      const errMsg: MessageRow = {
        id: `temp-error-${Date.now()}`,
        thread_id: thread.id,
        role: 'assistant',
        content: message,
        sender_id: null,
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setStreaming(false)
      setStreamingText('')
    }
  }

  async function handleDeleteThread() {
    if (deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      const result = await deleteThread(thread.id)
      if (!result.success) {
        setDeleteError(result.error || 'Could not delete conversation. Please try again.')
        return
      }
      setShowDeleteModal(false)
      router.push('/chat')
    } catch {
      setDeleteError('Could not delete conversation. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  async function handleRenameSubmit() {
    const nextTitle = draftTitle.trim() || 'New Chat'
    if (nextTitle === title) {
      setIsRenaming(false)
      return
    }

    setSavingTitle(true)
    const result = await updateThread(thread.id, { title: nextTitle })
    setSavingTitle(false)

    if (result.success) {
      setTitle(nextTitle)
      setDraftTitle(nextTitle)
      setIsRenaming(false)
      router.refresh()
    }
  }

  async function handleTogglePrivacy() {
    if (thread.owner_id !== profile.userId || savingPrivacy) return
    const nextShared = !isShared
    setSavingPrivacy(true)
    const result = await updateThread(thread.id, { is_shared: nextShared })
    setSavingPrivacy(false)
    if (result.success) {
      setIsShared(nextShared)
      router.refresh()
    }
  }

  function handleRenameCancel() {
    setDraftTitle(title)
    setIsRenaming(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  function insertEmoji(emoji: string) {
    const el = inputRef.current
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

  function getSenderName(msg: MessageRow): string {
    if (msg.role === 'assistant') return aiDisplayName
    if (msg.sender_id && memberNames?.[msg.sender_id]) return memberNames[msg.sender_id]
    return profile.displayName
  }

  function formatTimestamp(dateStr: string): string {
    const d = new Date(dateStr)
    const now = new Date()
    const isToday = d.toDateString() === now.toDateString()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    const isYesterday = d.toDateString() === yesterday.toDateString()

    const time = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
    if (isToday) return `Today at ${time}`
    if (isYesterday) return `Yesterday at ${time}`
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }) + ` at ${time}`
  }

  function renderAvatar(msg: MessageRow) {
    if (msg.role === 'assistant') {
      return (
        <div className={`${styles.avatar} ${styles.avatarAi}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ai.png" alt="" className={styles.avatarImg} />
        </div>
      )
    }

    const userId = msg.sender_id || profile.userId
    const src = avatarUrls[userId]
    const name = getSenderName(msg)

    return (
      <div className={styles.avatar}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className={styles.avatarImg} />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Thread header */}
      <div className={styles.header}>
        <div className={styles.headerInfo}>
          <div className={styles.titleBlock}>
            {isRenaming ? (
              <div className={styles.renameRow}>
                <input
                  className={styles.renameInput}
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleRenameSubmit()
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault()
                      handleRenameCancel()
                    }
                  }}
                  autoFocus
                  maxLength={120}
                />
                <button
                  type="button"
                  className={styles.headerBtn}
                  onClick={() => void handleRenameSubmit()}
                  disabled={savingTitle}
                >
                  {savingTitle ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  className={styles.headerBtnMuted}
                  onClick={handleRenameCancel}
                  disabled={savingTitle}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className={styles.titleRow}>
                <h2 className={styles.threadTitle}>{title}</h2>
                {thread.owner_id === profile.userId && (
                  <button
                    type="button"
                    className={styles.headerBtnMuted}
                    onClick={() => setIsRenaming(true)}
                  >
                    Rename
                  </button>
                )}
              </div>
            )}
            <div className={styles.threadMetaRow}>
              <span className={styles.threadModel}>
                {models.find((m) => m.id === thread.model)?.label ?? thread.model}
              </span>
              <button
                type="button"
                className={`${styles.privacyChip} ${isShared ? styles.privacyShared : styles.privacyPrivate}`}
                onClick={() => void handleTogglePrivacy()}
                disabled={thread.owner_id !== profile.userId || savingPrivacy}
                title={
                  thread.owner_id === profile.userId
                    ? isShared
                      ? 'Click to make this chat private'
                      : 'Click to share with family'
                    : undefined
                }
              >
                {savingPrivacy ? 'Saving...' : isShared ? 'Shared' : 'Private'}
              </button>
              {threadOwnerName && (
                <span className={styles.threadOwner}>By {threadOwnerName}</span>
              )}
            </div>
          </div>
        </div>
        <button
          className={styles.deleteBtn}
          onClick={() => {
            setDeleteError('')
            setShowDeleteModal(true)
          }}
          title="Delete thread"
        >
          🗑
        </button>
      </div>

      {/* Messages (Discord-style) */}
      <div className={styles.messages} ref={messagesRef}>
        {messages.length === 0 && !streaming && (
          <div className={styles.emptyState}>
            <p className={styles.emptyIcon}>💬</p>
            <p className={styles.emptyText}>Start a conversation</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={styles.messageRow}>
            {renderAvatar(msg)}
            <div className={styles.messageBody}>
              <div className={styles.messageMeta}>
                <span className={msg.role === 'assistant' ? styles.senderAi : styles.senderUser}>
                  {getSenderName(msg)}
                </span>
                <span className={styles.timestamp}>{formatTimestamp(msg.created_at)}</span>
              </div>
              <div className={styles.messageContent}>
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  <div
                    className={styles.markdown}
                    dangerouslySetInnerHTML={{ __html: simpleMarkdown(msg.content) }}
                  />
                )}
              </div>
            </div>
          </div>
        ))}

        {streaming && streamingText && (
          <div className={styles.messageRow}>
            <div className={`${styles.avatar} ${styles.avatarAi}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ai.png" alt="" className={styles.avatarImg} />
            </div>
            <div className={styles.messageBody}>
              <div className={styles.messageMeta}>
                <span className={styles.senderAi}>{aiDisplayName}</span>
                <span className={styles.timestamp}>Now</span>
              </div>
              <div className={styles.messageContent}>
                <div
                  className={styles.markdown}
                  dangerouslySetInnerHTML={{ __html: simpleMarkdown(streamingText) }}
                />
                <span className={styles.cursor}>▊</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className={styles.inputForm}>
        <EmojiPickerButton onSelect={insertEmoji} disabled={streaming} title="Add emoji to AI chat" />
        <textarea
          ref={inputRef}
          className={styles.textarea}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={streaming}
        />
        <button
          type="submit"
          className={styles.sendButton}
          disabled={!input.trim() || streaming}
        >
          {streaming ? '...' : '↑'}
        </button>
      </form>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className={styles.modalOverlay} onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Delete Conversation</h3>
            <p className={styles.modalText}>
              Are you sure you want to delete <strong>{title}</strong>? This action cannot be undone.
            </p>
            {deleteError && <p className={styles.modalError}>{deleteError}</p>}
            <div className={styles.modalActions}>
              <button
                className={styles.modalCancelBtn}
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className={styles.modalDeleteBtn}
                onClick={handleDeleteThread}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getAiDisplayName(modelId: string): string {
  const value = modelId.toLowerCase()
  if (value.includes('claude')) return 'Claude AI'
  if (value.includes('gpt') || value.includes('openai') || value.includes('o1') || value.includes('o3')) {
    return 'ChatGPT AI'
  }
  return 'AI'
}

/**
 * Very simple markdown-to-HTML for assistant messages.
 * Handles: bold, italic, inline code, code blocks, line breaks.
 */
function simpleMarkdown(text: string): string {
  return text
    // Code blocks: ```...```
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code: `...`
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold: **...**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic: *...*
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Line breaks
    .replace(/\n/g, '<br />')
}
