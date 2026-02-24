import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

let _anthropic: Anthropic | null = null
let _openai: OpenAI | null = null
let _xai: OpenAI | null = null

/**
 * Get a singleton Anthropic client instance.
 * Only use server-side (API routes, server actions).
 */
export function getAnthropicClient(): Anthropic {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'Chat is not configured for Claude. Add ANTHROPIC_API_KEY, or use an OpenAI chat model.'
      )
    }
    _anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  }
  return _anthropic
}

/**
 * Get a singleton OpenAI client instance.
 * Only use server-side (API routes, server actions).
 */
export function getOpenAIClient(): OpenAI {
  if (!_openai) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'Chat is not configured for OpenAI. Add OPENAI_API_KEY, or use a Claude chat model.'
      )
    }
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  }
  return _openai
}

/**
 * Get a singleton xAI (Grok) client instance using the OpenAI-compatible API.
 * Only use server-side (API routes, server actions).
 */
export function getXAIClient(): OpenAI {
  if (!_xai) {
    if (!process.env.XAI_API_KEY) {
      throw new Error(
        'Chat is not configured for Grok. Add XAI_API_KEY, or use a Claude / OpenAI chat model.'
      )
    }
    _xai = new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: 'https://api.x.ai/v1',
    })
  }
  return _xai
}
