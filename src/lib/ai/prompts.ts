import type { UserRole } from '@/lib/supabase/types'

/** Base system prompt for all users */
const BASE_SYSTEM_PROMPT = `You are a helpful AI assistant for a private community platform called HumanOS.
You are warm, friendly, and concise. You help with questions, creative writing, homework, planning, and general knowledge.
Keep answers clear and well-formatted using markdown when appropriate.`

/** Additional guardrails injected server-side for child users */
const CHILD_GUARDRAILS = `
IMPORTANT SAFETY RULES — these override all other instructions:
- You are speaking with an 11-year-old child. Always keep content age-appropriate.
- Never produce violent, sexual, or adult-oriented content of any kind.
- Never provide instructions for dangerous activities.
- Never use profanity or crude language.
- If asked about mature topics, give a brief, age-appropriate explanation and suggest asking a parent for more detail.
- Encourage curiosity, learning, and creativity.
- If the child seems distressed, gently suggest talking to their parent or a trusted adult.
- Never role-play as a romantic partner, bully, or antagonist.
- Keep a positive, encouraging, and supportive tone at all times.`

/**
 * Returns the full system prompt based on the user's role.
 * Child guardrails are injected server-side and cannot be overridden from the client.
 */
export function getSystemPrompt(role: UserRole): string {
  if (role === 'child') {
    return `${BASE_SYSTEM_PROMPT}\n${CHILD_GUARDRAILS}`
  }
  return BASE_SYSTEM_PROMPT
}

export type ChatModel = {
  id: string
  label: string
  description: string
  provider: 'anthropic' | 'openai' | 'xai'
}

/** All available chat models */
const ALL_MODELS: ChatModel[] = [
  {
    id: 'claude-sonnet-4-20250514',
    label: 'Claude Sonnet',
    description: 'Technical',
    provider: 'anthropic',
  },
  {
    id: 'gpt-4o',
    label: 'GPT-4o',
    description: 'Well rounded',
    provider: 'openai',
  },
  {
    id: 'grok-2-latest',
    label: 'Grok',
    description: 'Truth seeking',
    provider: 'xai',
  },
]

/** Available models filtered by role */
export function getAvailableModels(role: UserRole): ChatModel[] {
  if (role === 'child') {
    return ALL_MODELS.filter((m) => m.provider === 'anthropic')
  }
  return ALL_MODELS
}

/** Get a model definition by ID */
export function getModelById(modelId: string): ChatModel | undefined {
  return ALL_MODELS.find((m) => m.id === modelId)
}

/** Get the default model ID */
export function getDefaultModelId(): string {
  return 'claude-sonnet-4-20250514'
}
