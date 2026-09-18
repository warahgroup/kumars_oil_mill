import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

type BusinessSettings = {
  user_id: string
  business_name: string
  onboarding_completed: boolean
  currency_code: string
}

type State =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: BusinessSettings }

export function useBusinessSettings() {
  const { user } = useAuth()
  const [state, setState] = useState<State>({ status: 'loading' })

  const load = useCallback(async () => {
    if (!user) {
      setState({ status: 'empty' })
      return
    }
    setState({ status: 'loading' })
    const { data, error } = await supabase
      .from('business_settings')
      .select('user_id, business_name, onboarding_completed, currency_code')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      setState({ status: 'error', message: error.message })
      return
    }
    if (!data) {
      setState({ status: 'empty' })
      return
    }
    setState({ status: 'success', data })
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  return { state, reload: load }
}
