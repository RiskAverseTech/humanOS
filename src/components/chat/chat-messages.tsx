'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useProfile } from '@/components/providers/profile-provider'
import { getAvailableModels } from '@/lib/ai/prompts'
import type { MessageRow, ThreadRow } from '@/app/(app)/chat/actions'
import { updateThread, deleteThread } from '@/app/(app)/chat/actions'
import { useRouter } from 'next/navigation'
import styles from './chat-messages.module.css'

type ChatMessagesProps = {
  thread: ThreadRow
  initialMessages: MessageRow[]
  threadOwnerName?: string
}

export function ChatMessages({ thread, initialMessages, threadOwnerName }: ChatMessagesProps) {
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
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const models = getAvailableModels(profile.role)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, streamingText, scrollToBottom])

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
        created_at: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, errMsg])
    } finally {
      setStreaming(false)
      setStreamingText('')
    }
  }

  async function handleDeleteThread() {
    if (!confirm('Delete this conversation?')) return
    await deleteThread(thread.id)
    router.push('/chat')
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
        <button className={styles.deleteBtn} onClick={handleDeleteThread} title="Delete thread">
          🗑
        </button>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.length === 0 && !streaming && (
          <div className={styles.emptyState}>
            <p className={styles.emptyIcon}>💬</p>
            <p className={styles.emptyText}>Start a conversation</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${msg.role === 'user' ? styles.userMessage : styles.assistantMessage}`}
          >
            <div className={styles.messageBubble}>
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
          <div className={`${styles.message} ${styles.assistantMessage}`}>
            <div className={styles.messageBubble}>
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
    </div>
  )
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
