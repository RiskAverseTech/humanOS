'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile } from '@/lib/supabase/profile'
import type { NotificationCategory } from '@/lib/supabase/types'
import { createClient as createBrowserSupabaseClient } from '@/lib/supabase/client'
import {
  updateProfile,
  updatePassword,
  updateAppBillingSettings,
  updateUserRole,
  revokeInvitation,
  type AppBillingSettingsRow,
} from './actions'
import styles from './settings.module.css'

const NOTIFICATION_CATEGORY_OPTIONS: Array<{ id: NotificationCategory; label: string }> = [
  { id: 'notes', label: 'Notes' },
  { id: 'vault', label: 'Documents / Vault' },
  { id: 'todos', label: 'To Dos' },
  { id: 'human_chat', label: 'Human Chat' },
  { id: 'ai_chat', label: 'AI Chat' },
  { id: 'images', label: 'Images' },
]

const TIMEZONE_OPTIONS = [
  { id: 'America/New_York', label: 'Eastern (EST/EDT)' },
  { id: 'America/Chicago', label: 'Central (CST/CDT)' },
  { id: 'America/Denver', label: 'Mountain (MST/MDT)' },
  { id: 'America/Los_Angeles', label: 'Pacific (PST/PDT)' },
  { id: 'America/Phoenix', label: 'Arizona (MST)' },
  { id: 'America/Anchorage', label: 'Alaska (AKST/AKDT)' },
  { id: 'Pacific/Honolulu', label: 'Hawaii (HST)' },
  { id: 'UTC', label: 'UTC' },
] as const

type SettingsClientProps = {
  profile: Profile
  members: Array<{
    id: string
    user_id: string
    display_name: string
    role: string
    avatar_url: string | null
    created_at: string
  }>
  invitations: Array<{
    id: string
    email: string
    role: string
    token: string
    created_at: string
  }>
  billingSettings: AppBillingSettingsRow | null
}

export function SettingsClient({ profile, members, invitations, billingSettings }: SettingsClientProps) {
  const router = useRouter()

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Settings</h1>

      <ProfileSection profile={profile} />
      <PasswordSection />
      {profile.role === 'admin' && billingSettings && <BillingEstimateSection initialSettings={billingSettings} />}

      {profile.role === 'admin' && (
        <>
          <FamilyMembersSection members={members} currentUserId={profile.user_id} />
          <InviteSection />
          <PendingInvitesSection invitations={invitations} onRefresh={() => router.refresh()} />
        </>
      )}
    </div>
  )
}

function BillingEstimateSection({ initialSettings }: { initialSettings: AppBillingSettingsRow }) {
  const [form, setForm] = useState(initialSettings)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  function updateField<K extends keyof AppBillingSettingsRow>(key: K, value: number) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    const result = await updateAppBillingSettings({
      billing_openai_gpt4o_input_per_mtok: form.billing_openai_gpt4o_input_per_mtok,
      billing_openai_gpt4o_output_per_mtok: form.billing_openai_gpt4o_output_per_mtok,
      billing_anthropic_sonnet_input_per_mtok: form.billing_anthropic_sonnet_input_per_mtok,
      billing_anthropic_sonnet_output_per_mtok: form.billing_anthropic_sonnet_output_per_mtok,
      billing_gpt_image_15_per_image: form.billing_gpt_image_15_per_image,
      billing_gpt_image_1_per_image: form.billing_gpt_image_1_per_image,
      billing_dalle3_per_image: form.billing_dalle3_per_image,
      billing_fallback_image_per_image: form.billing_fallback_image_per_image,
    })
    setMessage(result.success ? 'Billing estimate settings updated.' : result.error || 'Failed')
    setSaving(false)
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Billing Estimate Settings</h2>
      <form onSubmit={handleSave} className={styles.form}>
        <div className={styles.inlineFields}>
          <BillingField label="GPT-4o Input / MTok" value={form.billing_openai_gpt4o_input_per_mtok} onChange={(v) => updateField('billing_openai_gpt4o_input_per_mtok', v)} />
          <BillingField label="GPT-4o Output / MTok" value={form.billing_openai_gpt4o_output_per_mtok} onChange={(v) => updateField('billing_openai_gpt4o_output_per_mtok', v)} />
        </div>
        <div className={styles.inlineFields}>
          <BillingField label="Claude Sonnet Input / MTok" value={form.billing_anthropic_sonnet_input_per_mtok} onChange={(v) => updateField('billing_anthropic_sonnet_input_per_mtok', v)} />
          <BillingField label="Claude Sonnet Output / MTok" value={form.billing_anthropic_sonnet_output_per_mtok} onChange={(v) => updateField('billing_anthropic_sonnet_output_per_mtok', v)} />
        </div>
        <div className={styles.inlineFields}>
          <BillingField label="GPT Image 1.5 / image" value={form.billing_gpt_image_15_per_image} onChange={(v) => updateField('billing_gpt_image_15_per_image', v)} />
          <BillingField label="GPT Image 1 / image" value={form.billing_gpt_image_1_per_image} onChange={(v) => updateField('billing_gpt_image_1_per_image', v)} />
        </div>
        <div className={styles.inlineFields}>
          <BillingField label="DALL-E 3 / image" value={form.billing_dalle3_per_image} onChange={(v) => updateField('billing_dalle3_per_image', v)} />
          <BillingField label="Fallback / image" value={form.billing_fallback_image_per_image} onChange={(v) => updateField('billing_fallback_image_per_image', v)} />
        </div>
        <div className={styles.actions}>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? 'Saving...' : 'Save Billing Settings'}
          </button>
          {message && <span className={styles.message}>{message}</span>}
        </div>
      </form>
    </section>
  )
}

function BillingField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <input
        type="number"
        step="0.001"
        min="0"
        className={styles.input}
        value={Number.isFinite(value) ? value : 0}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
      />
    </div>
  )
}

function ProfileSection({ profile }: { profile: Profile }) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(profile.display_name)
  const [themePreference, setThemePreference] = useState(profile.theme_preference)
  const [timezonePreference, setTimezonePreference] = useState(profile.timezone_preference || 'America/New_York')
  const [notificationsEnabled, setNotificationsEnabled] = useState(profile.notifications_enabled ?? true)
  const [notificationCategories, setNotificationCategories] = useState<NotificationCategory[]>(
    profile.notification_categories?.length
      ? profile.notification_categories
      : NOTIFICATION_CATEGORY_OPTIONS.map((o) => o.id)
  )
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
  const [avatarMessage, setAvatarMessage] = useState('')
  const [selectedAvatarName, setSelectedAvatarName] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false

    async function loadAvatarPreview() {
      if (!profile.avatar_url) {
        setAvatarPreviewUrl(null)
        return
      }

      if (/^https?:\/\//i.test(profile.avatar_url)) {
        setAvatarPreviewUrl(profile.avatar_url)
        return
      }

      const supabase = createBrowserSupabaseClient()
      const { data, error } = await supabase.storage
        .from('avatars')
        .createSignedUrl(profile.avatar_url, 3600)

      if (cancelled) return

      if (error) {
        setAvatarPreviewUrl(null)
        setAvatarMessage('Saved avatar exists, but preview could not be loaded.')
        return
      }

      setAvatarPreviewUrl(data.signedUrl)
    }

    void loadAvatarPreview()

    return () => {
      cancelled = true
    }
  }, [profile.avatar_url])

  useEffect(() => {
    setTimezonePreference(profile.timezone_preference || 'America/New_York')
    setNotificationsEnabled(profile.notifications_enabled ?? true)
    setNotificationCategories(
      profile.notification_categories?.length
        ? profile.notification_categories
        : NOTIFICATION_CATEGORY_OPTIONS.map((o) => o.id)
    )
  }, [profile.notifications_enabled, profile.notification_categories])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setMessage('')

    const result = await updateProfile({
      display_name: displayName,
      theme_preference: themePreference,
      timezone_preference: timezonePreference,
      notifications_enabled: notificationsEnabled,
      notification_categories: notificationCategories,
    })
    setMessage(result.success ? 'Profile updated!' : result.error || 'Failed')
    setSaving(false)
  }

  function toggleNotificationCategory(category: NotificationCategory) {
    setNotificationCategories((prev) => {
      const exists = prev.includes(category)
      if (exists) {
        const next = prev.filter((c) => c !== category)
        return next.length ? next : prev
      }
      return [...prev, category]
    })
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.currentTarget.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setAvatarMessage('Please choose an image file.')
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setAvatarMessage('Avatar must be 2MB or smaller.')
      return
    }

    setAvatarUploading(true)
    setAvatarMessage('')
    setSelectedAvatarName(file.name)

    try {
      const supabase = createBrowserSupabaseClient()
      const previousPath = profile.avatar_url
      const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
      const storagePath = `${profile.user_id}/${Date.now()}.${extension}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
        })

      if (uploadError) {
        throw new Error(uploadError.message)
      }

      const result = await updateProfile({ avatar_url: storagePath })
      if (!result.success) {
        throw new Error(result.error || 'Failed to save avatar')
      }

      const { data } = await supabase.storage
        .from('avatars')
        .createSignedUrl(storagePath, 3600)

      if (previousPath && !/^https?:\/\//i.test(previousPath) && previousPath !== storagePath) {
        await supabase.storage.from('avatars').remove([previousPath])
      }

      setAvatarPreviewUrl(data?.signedUrl ?? null)
      setAvatarMessage('Profile photo updated!')
      router.refresh()
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : 'Failed to upload avatar')
    } finally {
      setAvatarUploading(false)
    }
  }

  async function handleRemoveAvatar() {
    setAvatarUploading(true)
    setAvatarMessage('')

    try {
      const supabase = createBrowserSupabaseClient()
      const currentPath = profile.avatar_url

      const result = await updateProfile({ avatar_url: null })
      if (!result.success) {
        throw new Error(result.error || 'Failed to remove avatar')
      }

      if (currentPath && !/^https?:\/\//i.test(currentPath)) {
        await supabase.storage.from('avatars').remove([currentPath])
      }

      setAvatarPreviewUrl(null)
      setAvatarMessage('Profile photo removed.')
      setSelectedAvatarName(null)
      router.refresh()
    } catch (error) {
      setAvatarMessage(error instanceof Error ? error.message : 'Failed to remove avatar')
    } finally {
      setAvatarUploading(false)
    }
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Profile</h2>
      <form onSubmit={handleSave} className={styles.form}>
        <div className={styles.avatarRow}>
          <div className={styles.avatarPreview}>
            {avatarPreviewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarPreviewUrl} alt={`${profile.display_name} avatar`} className={styles.avatarImage} />
            ) : (
              profile.display_name.charAt(0).toUpperCase()
            )}
          </div>
          <div className={styles.avatarControls}>
            <label className={styles.label} htmlFor="avatar-upload">Profile Photo</label>
            <input
              ref={avatarInputRef}
              id="avatar-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className={styles.fileInputHidden}
              onChange={handleAvatarChange}
              disabled={avatarUploading}
            />
            <div className={styles.avatarUploadRow}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarUploading}
              >
                {avatarUploading ? 'Uploading...' : 'Choose Photo'}
              </button>
              <span className={styles.fileHint}>
                {selectedAvatarName ?? 'PNG, JPG, WEBP, GIF up to 2MB'}
              </span>
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={handleRemoveAvatar}
                disabled={avatarUploading || !(avatarPreviewUrl || profile.avatar_url)}
              >
                {avatarUploading ? 'Working...' : 'Remove Photo'}
              </button>
              {avatarMessage && (
                <span className={avatarMessage.includes('updated') || avatarMessage.includes('removed')
                  ? styles.successText
                  : styles.errorText}
                >
                  {avatarMessage}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Display Name</label>
          <input
            type="text"
            className={styles.input}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Role</label>
          <input type="text" className={styles.input} value={profile.role} disabled />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Theme</label>
          <div className={styles.themePicker} role="radiogroup" aria-label="Theme preference">
            <button
              type="button"
              className={`${styles.themeChip} ${themePreference === 'light' ? styles.themeChipActive : ''}`}
              onClick={() => setThemePreference('light')}
              aria-pressed={themePreference === 'light'}
            >
              Light
            </button>
            <button
              type="button"
              className={`${styles.themeChip} ${themePreference === 'dark' ? styles.themeChipActive : ''}`}
              onClick={() => setThemePreference('dark')}
              aria-pressed={themePreference === 'dark'}
            >
              Dark
            </button>
            <button
              type="button"
              className={`${styles.themeChip} ${themePreference === 'bray' ? styles.themeChipActive : ''} ${styles.themeChipBray}`}
              onClick={() => setThemePreference('bray')}
              aria-pressed={themePreference === 'bray'}
            >
              Bray mode
            </button>
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Time Zone</label>
          <select
            className={styles.input}
            value={timezonePreference}
            onChange={(e) => setTimezonePreference(e.target.value)}
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.label}
              </option>
            ))}
          </select>
          <p className={styles.helperCopy}>
            Used for dashboard activity timestamps. Default is Eastern time.
          </p>
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Notifications</label>
          <div className={styles.noticePanel}>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => setNotificationsEnabled(e.target.checked)}
              />
              <span>Enable in-app notifications (bell alerts)</span>
            </label>
            <div className={styles.checkboxGroup} aria-disabled={!notificationsEnabled}>
              {NOTIFICATION_CATEGORY_OPTIONS.map((option) => (
                <label key={option.id} className={styles.checkboxRow}>
                  <input
                    type="checkbox"
                    checked={notificationCategories.includes(option.id)}
                    disabled={!notificationsEnabled}
                    onChange={() => toggleNotificationCategory(option.id)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
            <p className={styles.helperCopy}>
              Default is all categories on. You can turn off any categories you do not want in the bell.
            </p>
          </div>
        </div>
        <div className={styles.actions}>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {message && <span className={styles.message}>{message}</span>}
        </div>
      </form>
    </section>
  )
}

function PasswordSection() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setMessage('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setMessage('Password must be at least 6 characters')
      return
    }

    setSaving(true)
    setMessage('')
    const result = await updatePassword(password)
    setMessage(result.success ? 'Password updated!' : result.error || 'Failed')
    if (result.success) {
      setPassword('')
      setConfirm('')
    }
    setSaving(false)
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Change Password</h2>
      <form onSubmit={handleSave} className={styles.form}>
        <div className={styles.field}>
          <label className={styles.label}>New Password</label>
          <input
            type="password"
            className={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
            required
            minLength={6}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Confirm Password</label>
          <input
            type="password"
            className={styles.input}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Confirm password"
            required
          />
        </div>
        <div className={styles.actions}>
          <button type="submit" className={styles.primaryBtn} disabled={saving}>
            {saving ? 'Updating...' : 'Update Password'}
          </button>
          {message && <span className={styles.message}>{message}</span>}
        </div>
      </form>
    </section>
  )
}

function FamilyMembersSection({
  members,
  currentUserId,
}: {
  members: SettingsClientProps['members']
  currentUserId: string
}) {
  const router = useRouter()

  async function handleRoleChange(profileId: string, newRole: 'admin' | 'partner' | 'child') {
    await updateUserRole(profileId, newRole)
    router.refresh()
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Family Members</h2>
      <div className={styles.memberList}>
        {members.map((member) => (
          <div key={member.id} className={styles.memberCard}>
            <div className={styles.memberAvatar}>
              {member.display_name.charAt(0).toUpperCase()}
            </div>
            <div className={styles.memberInfo}>
              <span className={styles.memberName}>
                {member.display_name}
                {member.user_id === currentUserId && ' (you)'}
              </span>
              <span className={styles.memberRole}>{member.role}</span>
            </div>
            {member.user_id !== currentUserId && (
              <select
                className={styles.roleSelect}
                value={member.role}
                onChange={(e) =>
                  handleRoleChange(member.id, e.target.value as 'admin' | 'partner' | 'child')
                }
              >
                <option value="admin">Admin</option>
                <option value="partner">Partner</option>
                <option value="child">Child</option>
              </select>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function InviteSection() {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'partner' | 'child'>('partner')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; inviteUrl?: string; error?: string } | null>(null)

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setResult(null)

    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })

      const data = await res.json()

      if (!res.ok) {
        setResult({ error: data.error })
      } else {
        setResult({ success: true, inviteUrl: data.inviteUrl })
        setEmail('')
      }
    } catch {
      setResult({ error: 'Failed to send invite' })
    }

    setSending(false)
  }

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Invite Family Member</h2>
      <form onSubmit={handleInvite} className={styles.form}>
        <div className={styles.inlineFields}>
          <input
            type="email"
            className={styles.input}
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <select
            className={styles.roleSelect}
            value={role}
            onChange={(e) => setRole(e.target.value as 'partner' | 'child')}
          >
            <option value="partner">Partner (adult)</option>
            <option value="child">Child</option>
          </select>
          <button type="submit" className={styles.primaryBtn} disabled={sending}>
            {sending ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
      </form>

      {result?.error && <p className={styles.errorText}>{result.error}</p>}
      {result?.success && result.inviteUrl && (
        <div className={styles.inviteResult}>
          <p className={styles.successText}>Invite sent! Share this link if the email doesn&apos;t arrive:</p>
          <code className={styles.inviteUrl}>{result.inviteUrl}</code>
        </div>
      )}
    </section>
  )
}

function PendingInvitesSection({
  invitations,
  onRefresh,
}: {
  invitations: SettingsClientProps['invitations']
  onRefresh: () => void
}) {
  async function handleRevoke(id: string) {
    if (!confirm('Revoke this invitation?')) return
    await revokeInvitation(id)
    onRefresh()
  }

  if (invitations.length === 0) return null

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Pending Invitations</h2>
      <div className={styles.memberList}>
        {invitations.map((inv) => (
          <div key={inv.id} className={styles.memberCard}>
            <div className={styles.memberInfo}>
              <span className={styles.memberName}>{inv.email}</span>
              <span className={styles.memberRole}>{inv.role} · Pending</span>
            </div>
            <button
              className={styles.revokeBtn}
              onClick={() => handleRevoke(inv.id)}
            >
              Revoke
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
