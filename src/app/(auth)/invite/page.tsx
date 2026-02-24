'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import styles from '@/components/ui/form-styles.module.css'

type InviteStatus = 'loading' | 'valid' | 'invalid' | 'accepted'

export default function InvitePage() {
  return (
    <Suspense fallback={<p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Loading...</p>}>
      <InviteForm />
    </Suspense>
  )
}

function InviteForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<InviteStatus>('loading')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    if (!token) {
      setStatus('invalid')
      return
    }

    async function verifyToken() {
      try {
        const res = await fetch(`/api/invite/verify?token=${token}`)
        const data = await res.json()

        if (!res.ok) {
          setStatus('invalid')
          return
        }

        if (data.status === 'accepted') {
          setStatus('accepted')
          return
        }

        setInviteEmail(data.email)
        setInviteRole(data.role)
        setStatus('valid')
      } catch {
        setStatus('invalid')
      }
    }

    verifyToken()
  }, [token])

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match.' })
      setLoading(false)
      return
    }

    if (password.length < 6) {
      setMessage({ type: 'error', text: 'Password must be at least 6 characters.' })
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email: inviteEmail,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({
        type: 'success',
        text: 'Account created! Check your email to confirm, then sign in.',
      })
    }

    setLoading(false)
  }

  async function handleMagicLink() {
    setLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.signInWithOtp({
      email: inviteEmail,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    } else {
      setMessage({ type: 'success', text: 'Check your email for a login link!' })
    }

    setLoading(false)
  }

  if (status === 'loading') {
    return <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>Verifying invite...</p>
  }

  if (status === 'invalid') {
    return (
      <div className={styles.messageError}>
        This invite link is invalid or has expired. Ask your admin for a new one.
      </div>
    )
  }

  if (status === 'accepted') {
    return (
      <div className={styles.messageSuccess}>
        This invite has already been accepted.{' '}
        <a href="/login" className={styles.link}>
          Sign in here
        </a>
      </div>
    )
  }

  return (
    <>
      <p style={{ textAlign: 'center', marginBottom: 'var(--space-4)', color: 'var(--color-text-secondary)' }}>
        You&apos;ve been invited to join as <strong>{inviteRole}</strong>
      </p>

      {message && (
        <div className={message.type === 'error' ? styles.messageError : styles.messageSuccess}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSignup}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Email</label>
          <input
            type="email"
            className={styles.input}
            value={inviteEmail}
            disabled
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="password" className={styles.label}>
            Create a password
          </label>
          <input
            id="password"
            type="password"
            className={styles.input}
            placeholder="At least 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="confirmPassword" className={styles.label}>
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            className={styles.input}
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
          />
        </div>

        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <div className={styles.divider}>or</div>

      <button
        type="button"
        className={styles.buttonSecondary}
        onClick={handleMagicLink}
        disabled={loading}
      >
        Just send me a magic link
      </button>
    </>
  )
}
