'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import styles from '@/components/ui/form-styles.module.css'

type AuthMode = 'magic-link' | 'password'

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('magic-link')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const supabase = createClient()

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
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

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setMessage({ type: 'error', text: error.message })
    }
    // On success, middleware handles redirect to /dashboard

    setLoading(false)
  }

  return (
    <>
      {message && (
        <div className={message.type === 'error' ? styles.messageError : styles.messageSuccess}>
          {message.text}
        </div>
      )}

      {mode === 'magic-link' ? (
        <form onSubmit={handleMagicLink}>
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email address
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Sending link...' : 'Send magic link'}
          </button>

          <div className={styles.divider}>or</div>

          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={() => setMode('password')}
          >
            Sign in with password
          </button>
        </form>
      ) : (
        <form onSubmit={handlePasswordLogin}>
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              Email address
            </label>
            <input
              id="email"
              type="email"
              className={styles.input}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              Password
            </label>
            <input
              id="password"
              type="password"
              className={styles.input}
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className={styles.button} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>

          <div className={styles.divider}>or</div>

          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={() => setMode('magic-link')}
          >
            Use magic link instead
          </button>
        </form>
      )}
    </>
  )
}
