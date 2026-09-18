import { useCallback, useState } from 'react'
import { toFriendlyError } from '@/lib/friendlyErrors'

type SubmitState = 'idle' | 'loading' | 'success' | 'error'

export function useSubmit() {
  const [state, setState] = useState<SubmitState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const run = useCallback(async (fn: () => Promise<void>, successMsg: string) => {
    if (state === 'loading') return
    setState('loading')
    setError(null)
    setSuccessMessage(null)
    try {
      await fn()
      setState('success')
      setSuccessMessage(successMsg)
    } catch (err) {
      setState('error')
      const raw = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      setError(toFriendlyError(raw))
    }
  }, [state])

  const reset = useCallback(() => {
    setState('idle')
    setError(null)
    setSuccessMessage(null)
  }, [])

  return { state, error, successMessage, run, reset, isSaving: state === 'loading' }
}
