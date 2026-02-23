'use client'

import { ErrorDisplay } from '@/components/ui/error-boundary'

export default function VaultError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorDisplay error={error} reset={reset} title="Couldn't load vault" />
}
