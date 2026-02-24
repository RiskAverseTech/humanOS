import Link from 'next/link'
import { getProfile } from '@/lib/supabase/profile'
import { getNotificationEvents } from '@/lib/activity/events'
import { getSystemPrompt } from '@/lib/ai/prompts'
import { createClient } from '@/lib/supabase/server'
import type { NotificationCategory, UserRole } from '@/lib/supabase/types'
import styles from './dashboard.module.css'

export default async function DashboardPage() {
  const profile = await getProfile()
  const timezone = profile?.timezone_preference || 'America/New_York'
  const supabase = await createClient()
  const { data: billingSettings } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', true)
    .maybeSingle()

  const userId = profile?.user_id

  // Fetch recent activity (own items only) + billing data (all items) in parallel
  const [
    { data: recentNotes },
    { data: recentDocs },
    { data: recentChats },
    { data: recentImages },
    ,
    ,
    { data: allThreads },
    { data: allMessages },
    { data: allGeneratedImages },
  ] = await Promise.all([
    supabase
      .from('notes')
      .select('id, title, updated_at, is_shared, owner_id')
      .eq('owner_id', userId!)
      .order('updated_at', { ascending: false })
      .limit(5),
    supabase
      .from('documents')
      .select('id, file_name, created_at, is_shared, owner_id')
      .eq('owner_id', userId!)
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('chat_threads')
      .select('id, title, created_at, owner_id')
      .eq('owner_id', userId!)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('generated_images')
      .select('id, prompt, created_at, owner_id')
      .eq('owner_id', userId!)
      .order('created_at', { ascending: false })
      .limit(3),
    supabase
      .from('family_chat_channels')
      .select('id, name, updated_at, owner_id')
      .eq('owner_id', userId!)
      .order('updated_at', { ascending: false })
      .limit(3),
    supabase
      .from('todo_cards')
      .select('id, title, updated_at, owner_id')
      .eq('owner_id', userId!)
      .order('updated_at', { ascending: false })
      .limit(3),
    supabase
      .from('chat_threads')
      .select('id, owner_id, model'),
    supabase
      .from('chat_messages')
      .select('thread_id, role, content, created_at')
      .order('created_at', { ascending: true }),
    supabase
      .from('generated_images')
      .select('model'),
  ])

  const threadOwnerIds = Array.from(new Set((allThreads ?? []).map((t) => t.owner_id)))
  const { data: threadOwnerProfiles } = threadOwnerIds.length
    ? await supabase
        .from('profiles')
        .select('user_id, role')
        .in('user_id', threadOwnerIds)
    : { data: [] as Array<{ user_id: string; role: UserRole }> }

  const billing = estimateFamilyOSCosts({
    threads: (allThreads ?? []) as Array<{ id: string; owner_id: string; model: string }>,
    messages: (allMessages ?? []) as Array<{
      thread_id: string
      role: 'user' | 'assistant' | 'system'
      content: string
      created_at: string
    }>,
    threadOwnerRoles: Object.fromEntries(
      (threadOwnerProfiles ?? []).map((p) => [p.user_id, p.role as UserRole])
    ),
    generatedImages: (allGeneratedImages ?? []) as Array<{ model: string | null }>,
    pricing: billingSettings,
  })

  const defaultCategories: NotificationCategory[] = ['notes', 'vault', 'todos', 'human_chat', 'ai_chat', 'images']
  const notificationCategories = (profile?.notification_categories?.length
    ? profile.notification_categories
    : defaultCategories) as NotificationCategory[]

  const recentActivity = await getNotificationEvents({ categories: notificationCategories, limit: 30 })
    .then((items) => items.filter((item) => item.ownerId === userId).slice(0, 10))

  return (
    <div className={styles.container}>
      <h1 className={styles.greeting}>
        Welcome back, {profile?.display_name ?? 'there'}
      </h1>

      {/* Quick action cards */}
      <div className={styles.grid}>
        <QuickCard icon="📝" title="New Note" href="/notes/new" />
        <QuickCard icon="💬" title="New Chat" href="/chat" />
        <QuickCard icon="📁" title="Upload File" href="/vault" />
        {profile?.role !== 'child' && (
          <QuickCard icon="🎨" title="Generate Image" href="/images" />
        )}
      </div>

      {/* Stats */}
      <div className={styles.stats}>
        <StatCard label="Notes" count={recentNotes?.length ?? 0} icon="📝" />
        <StatCard label="Documents" count={recentDocs?.length ?? 0} icon="📁" />
        <StatCard label="Chats" count={recentChats?.length ?? 0} icon="💬" />
        <StatCard label="Images" count={recentImages?.length ?? 0} icon="🎨" />
      </div>

      <section className={styles.billCard} aria-label="Daddy Bill cost estimate">
        <div className={styles.billHeader}>
          <div>
            <h2 className={styles.billTitle}>Daddy&apos;s AI Bill</h2>
            <p className={styles.billSubtitle}>Estimated platform spend (chat + image APIs)</p>
          </div>
          <div className={styles.billTotal}>
            ${billing.totalRoundedUsd.toFixed(2)}
          </div>
        </div>
        <div className={styles.billGrid}>
          <div className={styles.billItem}>
            <span className={styles.billLabel}>Chat estimate</span>
            <span className={styles.billValue}>${billing.chatUsd.toFixed(2)}</span>
          </div>
          <div className={styles.billItem}>
            <span className={styles.billLabel}>Image estimate</span>
            <span className={styles.billValue}>${billing.imageUsd.toFixed(2)}</span>
          </div>
          <div className={styles.billItem}>
            <span className={styles.billLabel}>Chats billed (approx)</span>
            <span className={styles.billValue}>{billing.chatTurns}</span>
          </div>
          <div className={styles.billItem}>
            <span className={styles.billLabel}>Images billed (count)</span>
            <span className={styles.billValue}>{billing.imageCount}</span>
          </div>
        </div>
        <p className={styles.billFootnote}>
          Rounded up. Chat cost is estimated from saved message text (approx tokens, conversation replay included).
          Image cost uses per-image estimates because size/quality usage is not stored.
        </p>
      </section>

      {/* Recent activity */}
      <div className={styles.activitySection}>
        <Link href="/activity" className={styles.sectionTitleLink}>
          <h2 className={styles.sectionTitle}>Your Recent Activity</h2>
        </Link>
        {recentActivity.length === 0 ? (
          <p className={styles.emptyText}>No activity yet. Start by creating a note or chat!</p>
        ) : (
          <div className={styles.activityList}>
            {recentActivity.map((item, i) => (
              <Link key={`${item.type}-${i}`} href={item.href} className={styles.activityItem}>
                <span className={styles.activityIcon}>{item.icon}</span>
                <div className={styles.activityText}>
                  <span className={styles.activityTitle}>{item.title}</span>
                  {item.ownerName && <span className={styles.activityOwner}>By {item.ownerName}</span>}
                </div>
                <span className={styles.activityDate}>
                  {formatActivityDate(item.date, timezone)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatActivityDate(dateIso: string, timeZone: string): string {
  const date = new Date(dateIso)
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  } catch {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date)
  }
}

type BillingInput = {
  threads: Array<{ id: string; owner_id: string; model: string }>
  messages: Array<{ thread_id: string; role: 'user' | 'assistant' | 'system'; content: string; created_at: string }>
  threadOwnerRoles: Record<string, UserRole>
  generatedImages: Array<{ model: string | null }>
  pricing: AppBillingSettingsRow | null
}

type AppBillingSettingsRow = {
  billing_openai_gpt4o_input_per_mtok: number
  billing_openai_gpt4o_output_per_mtok: number
  billing_anthropic_sonnet_input_per_mtok: number
  billing_anthropic_sonnet_output_per_mtok: number
  billing_gpt_image_15_per_image: number
  billing_gpt_image_1_per_image: number
  billing_dalle3_per_image: number
  billing_fallback_image_per_image: number
}

function estimateFamilyOSCosts(input: BillingInput) {
  const pricingRow = input.pricing
  const CHAT_PRICES_PER_MTOK: Record<string, { input: number; output: number }> = {
    'gpt-4o': {
      input: pricingRow?.billing_openai_gpt4o_input_per_mtok ?? 2.5,
      output: pricingRow?.billing_openai_gpt4o_output_per_mtok ?? 10,
    },
    'claude-sonnet-4-20250514': {
      input: pricingRow?.billing_anthropic_sonnet_input_per_mtok ?? 3,
      output: pricingRow?.billing_anthropic_sonnet_output_per_mtok ?? 15,
    },
  }

  // Image rows do not store exact size/quality, so these are conservative per-image estimates.
  const IMAGE_ESTIMATE_PER_IMAGE: Record<string, number> = {
    'gpt-image-1': pricingRow?.billing_gpt_image_1_per_image ?? 0.04,
    'gpt-image-1.5': pricingRow?.billing_gpt_image_15_per_image ?? 0.042,
    'dall-e-3': pricingRow?.billing_dalle3_per_image ?? 0.08,
  }

  const messagesByThread = new Map<string, BillingInput['messages']>()
  for (const message of input.messages) {
    if (!messagesByThread.has(message.thread_id)) {
      messagesByThread.set(message.thread_id, [])
    }
    messagesByThread.get(message.thread_id)!.push(message)
  }

  let chatUsd = 0
  let chatTurns = 0

  for (const thread of input.threads) {
    const pricing = CHAT_PRICES_PER_MTOK[thread.model]
    if (!pricing) continue

    const threadMessages = (messagesByThread.get(thread.id) ?? []).slice().sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
    const ownerRole = input.threadOwnerRoles[thread.owner_id] ?? 'partner'
    const systemPromptTokens = approxTokens(getSystemPrompt(ownerRole))

    let historyTokens = 0

    for (const msg of threadMessages) {
      const tokens = approxTokens(msg.content)

      if (msg.role === 'assistant') {
        const inputTokens = systemPromptTokens + historyTokens
        const outputTokens = tokens
        chatUsd += (inputTokens / 1_000_000) * pricing.input
        chatUsd += (outputTokens / 1_000_000) * pricing.output
        chatTurns += 1
        historyTokens += tokens
        continue
      }

      historyTokens += tokens
    }
  }

  let imageUsd = 0
  for (const image of input.generatedImages) {
    const model = image.model ?? 'unknown'
    imageUsd += IMAGE_ESTIMATE_PER_IMAGE[model] ?? (pricingRow?.billing_fallback_image_per_image ?? 0.05)
  }

  const total = chatUsd + imageUsd
  const totalRoundedUsd = Math.ceil(total * 100) / 100

  return {
    chatUsd,
    imageUsd,
    imageCount: input.generatedImages.length,
    chatTurns,
    totalRoundedUsd,
  }
}

function approxTokens(text: string | null | undefined): number {
  if (!text) return 0
  // Rough heuristic for English text; real usage may vary.
  return Math.ceil(text.length / 4)
}

function QuickCard({ icon, title, href }: { icon: string; title: string; href: string }) {
  return (
    <Link href={href} className={styles.card}>
      <span className={styles.cardIcon}>{icon}</span>
      <span className={styles.cardTitle}>{title}</span>
    </Link>
  )
}

function StatCard({ label, count, icon }: { label: string; count: number; icon: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statIcon}>{icon}</span>
      <span className={styles.statCount}>{count}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}
