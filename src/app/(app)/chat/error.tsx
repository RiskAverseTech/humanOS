'use client'

import { ErrorDisplay } from '@/components/ui/error-boundary'

export default function ChatError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorDisplay error={error} reset={reset} title="Chat unavailable" />
}
