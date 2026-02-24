import { createClient } from '@/lib/supabase/server'
import { getAnthropicClient, getOpenAIClient, getXAIClient } from '@/lib/ai/client'
import { getSystemPrompt, getModelById, getDefaultModelId } from '@/lib/ai/prompts'
import type { UserRole } from '@/lib/supabase/types'
import { logActivityEvent } from '@/lib/activity/events'

export const runtime = 'edge'

/**
 * POST /api/chat
 * Streams an AI response for the given thread.
 * Supports both Anthropic (Claude) and OpenAI (GPT) models.
 * Multiple members can chat in the same shared thread concurrently.
 *
 * Body: {
 *   threadId: string
 *   message: string
 *   model?: string
 * }
 *
 * Returns: ReadableStream of text chunks (Server-Sent Events format)
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return new Response('Unauthorized', { status: 401 })
    }

    // Get user's role for guardrails
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return new Response('Profile not found', { status: 404 })
    }

    const role = profile.role as UserRole
    const body = await request.json()
    const { threadId, message, model: requestedModel, replyToMessageId } = body as {
      threadId: string
      message: string
      model?: string
      replyToMessageId?: string | null
    }

    if (!threadId || !message) {
      return new Response('threadId and message are required', { status: 400 })
    }

    // Resolve model — child is forced to Claude Sonnet
    let modelId = requestedModel || getDefaultModelId()
    if (role === 'child') {
      modelId = 'claude-sonnet-4-20250514'
    }

    const modelDef = getModelById(modelId)
    if (!modelDef) {
      return new Response(`Unknown model: ${modelId}`, { status: 400 })
    }

    if (modelDef.provider === 'anthropic' && !process.env.ANTHROPIC_API_KEY) {
      return new Response(
        'Claude chat is not configured. Add ANTHROPIC_API_KEY or start a GPT-4o chat.',
        { status: 503 }
      )
    }

    if (modelDef.provider === 'openai' && !process.env.OPENAI_API_KEY) {
      return new Response(
        'OpenAI chat is not configured. Add OPENAI_API_KEY or start a Claude chat.',
        { status: 503 }
      )
    }

    if (modelDef.provider === 'xai' && !process.env.XAI_API_KEY) {
      return new Response(
        'Grok chat is not configured. Add XAI_API_KEY or start a Claude / OpenAI chat.',
        { status: 503 }
      )
    }

    // Verify thread access (RLS handles this)
    const { data: thread, error: threadError } = await supabase
      .from('chat_threads')
      .select('id, owner_id, is_shared')
      .eq('id', threadId)
      .single()

    if (threadError || !thread) {
      return new Response('Thread not found', { status: 404 })
    }

    // Save the user's message with sender_id
    await supabase.from('chat_messages').insert({
      thread_id: threadId,
      role: 'user',
      content: message,
      sender_id: user.id,
      reply_to_message_id: replyToMessageId ?? null,
    })
    void logActivityEvent({
      actorUserId: user.id,
      category: 'ai_chat',
      entityType: 'ai_chat_message',
      entityId: threadId,
      action: 'message_posted',
      title: message.slice(0, 80),
      href: `/chat/${threadId}`,
    })

    // Fetch conversation history for context
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(50)

    const messages = (history ?? []).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }))

    // Get system prompt (child guardrails injected server-side)
    const systemPrompt = getSystemPrompt(role)

    // Build SSE stream based on provider
    const encoder = new TextEncoder()
    let fullResponse = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          if (modelDef.provider === 'anthropic') {
            await streamAnthropic(controller, encoder, modelId, systemPrompt, messages, (text) => {
              fullResponse += text
            })
          } else if (modelDef.provider === 'xai') {
            await streamOpenAICompatible(getXAIClient(), controller, encoder, modelId, systemPrompt, messages, (text) => {
              fullResponse += text
            })
          } else {
            await streamOpenAICompatible(getOpenAIClient(), controller, encoder, modelId, systemPrompt, messages, (text) => {
              fullResponse += text
            })
          }

          // Signal stream end
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))

          // Save the full assistant response
          if (fullResponse.trim().length > 0) {
            await supabase.from('chat_messages').insert({
              thread_id: threadId,
              role: 'assistant',
              content: fullResponse,
            })
          }

          controller.close()
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : 'Stream error'
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return new Response('Internal server error', { status: 500 })
  }
}

/** Stream from Anthropic (Claude) */
async function streamAnthropic(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  onText: (text: string) => void
) {
  const anthropic = getAnthropicClient()

  const stream = anthropic.messages.stream({
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  })

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      const text = event.delta.text
      onText(text)
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
    }
  }
}

/** Stream from OpenAI (GPT) */
async function streamOpenAICompatible(
  openai: ReturnType<typeof getOpenAIClient>,
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  onText: (text: string) => void
) {
  const stream = await openai.chat.completions.create({
    model,
    max_tokens: 4096,
    stream: true,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  })

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content
    if (text) {
      onText(text)
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
    }
  }
}
