import { useCallback, useEffect, useState } from 'react'

type QueryState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T }

export function useQuery<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' })

  const reload = useCallback(async () => {
    setState({ status: 'loading' })
    try {
      const data = await loader()
      setState({ status: 'success', data })
    } catch (err) {
      setState({
        status: 'error',
        message: err instanceof Error ? err.message : 'Failed to load data',
      })
    }
  }, deps)

  useEffect(() => {
    void reload()
  }, [reload])

  return { state, reload }
}
