import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logActivityEvent } from '@/lib/activity/events'

const DEFAULT_IMAGE_MODEL = 'gpt-image-1.5'
const GROK_IMAGE_MODEL = 'grok-imagine-image'
type ImageModel = typeof DEFAULT_IMAGE_MODEL | typeof GROK_IMAGE_MODEL
type ImageSize = '1024x1024' | '1024x1536' | '1536x1024'

/**
 * POST /api/images
 * Generate or edit an image via OpenAI Images API.
 *
 * Body:
 * {
 *   prompt: string
 *   mode?: 'generate' | 'edit'
 *   size?: '1024x1024' | '1024x1536' | '1536x1024'
 *   sourceStoragePath?: string // required for edit mode
 * }
 *
 * Returns: { id, url, storagePath }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    let prompt = ''
    let mode: 'generate' | 'edit' = 'generate'
    let size: ImageSize = '1024x1024'
    let model: ImageModel = DEFAULT_IMAGE_MODEL
    let sourceStoragePath: string | undefined
    let sourceUploadFile: File | null = null

    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      prompt = String(form.get('prompt') ?? '')
      const modeValue = String(form.get('mode') ?? 'generate')
      const sizeValue = String(form.get('size') ?? '1024x1024')
      const modelValue = String(form.get('model') ?? DEFAULT_IMAGE_MODEL)
      sourceStoragePath = form.get('sourceStoragePath') ? String(form.get('sourceStoragePath')) : undefined
      const filePart = form.get('image')
      sourceUploadFile = filePart instanceof File ? filePart : null
      mode = modeValue === 'edit' ? 'edit' : 'generate'
      if (sizeValue === '1024x1024' || sizeValue === '1024x1536' || sizeValue === '1536x1024') {
        size = sizeValue
      }
      if (modelValue === DEFAULT_IMAGE_MODEL || modelValue === GROK_IMAGE_MODEL) {
        model = modelValue
      }
    } else {
      const body = await request.json()
      const parsed = body as {
        prompt: string
        mode?: 'generate' | 'edit'
        size?: ImageSize
        model?: ImageModel
        sourceStoragePath?: string
      }
      prompt = parsed.prompt
      mode = parsed.mode ?? 'generate'
      size = parsed.size ?? '1024x1024'
      model = parsed.model ?? DEFAULT_IMAGE_MODEL
      sourceStoragePath = parsed.sourceStoragePath
    }

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (!['generate', 'edit'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 })
    }

    if (mode === 'edit' && !sourceStoragePath && !sourceUploadFile) {
      return NextResponse.json({ error: 'Select or upload an image to edit first.' }, { status: 400 })
    }

    if (mode === 'edit' && model === GROK_IMAGE_MODEL) {
      return NextResponse.json(
        { error: 'Grok Imagine edits are not supported yet. Use GPT Image for edit mode.' },
        { status: 400 }
      )
    }

    if (model === GROK_IMAGE_MODEL && !process.env.XAI_API_KEY) {
      return NextResponse.json(
        { error: 'Grok Imagine is not configured. Add XAI_API_KEY to environment.' },
        { status: 503 }
      )
    }

    if (model === DEFAULT_IMAGE_MODEL && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Image generation is not configured. Add OPENAI_API_KEY to environment.' },
        { status: 503 }
      )
    }

    const imageApiResponse =
      model === GROK_IMAGE_MODEL
        ? await callGrokImageGenerate({
            apiKey: process.env.XAI_API_KEY!,
            prompt: prompt.trim(),
            size,
          })
        : mode === 'edit'
        ? sourceUploadFile
          ? await callOpenAIImageEditWithUpload({
              apiKey: process.env.OPENAI_API_KEY!,
              prompt: prompt.trim(),
              size,
              imageFile: sourceUploadFile,
            })
          : await callOpenAIImageEdit({
              apiKey: process.env.OPENAI_API_KEY!,
              prompt: prompt.trim(),
              size,
              sourceStoragePath: sourceStoragePath!,
              supabase,
            })
        : await callOpenAIImageGenerate({
            apiKey: process.env.OPENAI_API_KEY!,
            prompt: prompt.trim(),
            size,
          })

    if (!imageApiResponse.ok) {
      const err = await imageApiResponse.json().catch(() => ({}))
      const message =
        (err as { error?: { message?: string } })?.error?.message ||
        (err as { error?: string })?.error ||
        (mode === 'edit' ? 'Image edit failed' : 'Image generation failed')
      return NextResponse.json({ error: message }, { status: imageApiResponse.status })
    }

    const result = (await imageApiResponse.json()) as {
      data?: Array<{ url?: string; b64_json?: string; revised_prompt?: string }>
    }
    const first = result.data?.[0]
    if (!first) {
      return NextResponse.json({ error: 'No image returned' }, { status: 500 })
    }

    const imageBlob = await openAIImageResponseToBlob(first)
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.png`
    const storagePath = `${user.id}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('generated-images')
      .upload(storagePath, imageBlob, {
        contentType: 'image/png',
        cacheControl: '3600',
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      // The image was generated, but we failed to persist it in Supabase Storage.
      return NextResponse.json({
        id: null,
        storagePath: null,
        error: 'Image generated but failed to save to vault',
      })
    }

    // Save record to database
    const { data: record } = await supabase
      .from('generated_images')
      .insert({
        owner_id: user.id,
        prompt,
        storage_path: storagePath,
        model,
      })
      .select('id')
      .single()

    if (record?.id) {
      void logActivityEvent({
        actorUserId: user.id,
        category: 'images',
        entityType: 'image',
        entityId: record.id,
        action: mode === 'edit' ? 'updated' : 'created',
        title: prompt.trim().slice(0, 120),
        href: '/images',
      })
    }

    return NextResponse.json({
      id: record?.id,
      storagePath,
      revisedPrompt: first.revised_prompt,
    })
  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function callOpenAIImageGenerate(input: {
  apiKey: string
  prompt: string
  size: ImageSize
}) {
  return fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_IMAGE_MODEL,
      prompt: input.prompt,
      n: 1,
      size: input.size,
    }),
  })
}

async function callOpenAIImageEdit(input: {
  apiKey: string
  prompt: string
  size: ImageSize
  sourceStoragePath: string
  supabase: Awaited<ReturnType<typeof createClient>>
}) {
  const { data: sourceBlob, error: downloadError } = await input.supabase.storage
    .from('generated-images')
    .download(input.sourceStoragePath)

  if (downloadError || !sourceBlob) {
    throw new Error(downloadError?.message || 'Could not load source image for edit')
  }

  const formData = new FormData()
  formData.append('model', DEFAULT_IMAGE_MODEL)
  formData.append('prompt', input.prompt)
  formData.append('size', input.size)
  formData.append('image', sourceBlob, 'source.png')

  return fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: formData,
  })
}

async function callOpenAIImageEditWithUpload(input: {
  apiKey: string
  prompt: string
  size: ImageSize
  imageFile: File
}) {
  const formData = new FormData()
  formData.append('model', DEFAULT_IMAGE_MODEL)
  formData.append('prompt', input.prompt)
  formData.append('size', input.size)
  formData.append('image', input.imageFile, input.imageFile.name || 'source.png')

  return fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: formData,
  })
}

async function callGrokImageGenerate(input: {
  apiKey: string
  prompt: string
  size: ImageSize
}) {
  return fetch('https://api.x.ai/v1/images/generations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: GROK_IMAGE_MODEL,
      prompt: input.prompt,
      n: 1,
      aspect_ratio: mapSizeToAspectRatio(input.size),
    }),
  })
}

function mapSizeToAspectRatio(size: ImageSize): '1:1' | '2:3' | '3:2' {
  if (size === '1024x1536') return '2:3'
  if (size === '1536x1024') return '3:2'
  return '1:1'
}

async function openAIImageResponseToBlob(image: {
  url?: string
  b64_json?: string
}): Promise<Blob> {
  if (image.b64_json) {
    const buffer = Buffer.from(image.b64_json, 'base64')
    return new Blob([buffer], { type: 'image/png' })
  }

  if (image.url) {
    const imageResponse = await fetch(image.url)
    return imageResponse.blob()
  }

  throw new Error('OpenAI returned no image payload')
}
