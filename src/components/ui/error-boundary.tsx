'use client'

import Link from 'next/link'
import styles from './error-boundary.module.css'

type ErrorDisplayProps = {
  error: Error & { digest?: string }
  reset: () => void
  title?: string
}

export function ErrorDisplay({ error, reset, title = 'Something went wrong' }: ErrorDisplayProps) {
  return (
    <div className={styles.container}>
      <span className={styles.icon}>😕</span>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>
        An unexpected error occurred. You can try again or head back to the dashboard.
      </p>
      <div className={styles.actions}>
        <button className={styles.retryBtn} onClick={reset}>
          Try again
        </button>
        <Link href="/dashboard" className={styles.homeLink}>
          Back to Home
        </Link>
      </div>
      {process.env.NODE_ENV === 'development' && error.message && (
        <pre className={styles.details}>{error.message}</pre>
      )}
    </div>
  )
}
