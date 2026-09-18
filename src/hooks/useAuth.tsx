import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { prefetchCommonAppData } from '@/lib/prefetchAppData'
import { seedDefaultBusinessData } from '@/services/onboardingService'

type AuthContextValue = {
  user: User | null
  session: Session | null
  loading: boolean
  authError: string | null
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function envCredential(name: 'VITE_SINGLE_USER_EMAIL' | 'VITE_SINGLE_USER_PASSWORD'): string {
  const raw = import.meta.env[name]
  if (typeof raw !== 'string') return ''
  return raw.trim()
}

function normalizeAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid') && m.includes('email')) {
    return (
      'Supabase rejected this email on sign-up. In the Supabase dashboard: turn on Authentication → Providers → Email, ' +
      'allow sign-ups (or add the user under Authentication → Users with email kumar@gmail.com and password kumaroilmill). ' +
      'Then restart the app.'
    )
  }
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) {
    return (
      'Sign-ups are turned off. Add the user manually: Supabase → Authentication → Users → Add user ' +
      '(kumar@gmail.com / kumaroilmill), matching your .env.'
    )
  }
  if (m.includes('already registered') || m.includes('already been registered')) {
    return (
      'This email is already in Supabase but the password in .env does not match. Reset the user password in ' +
      'Authentication → Users to kumaroilmill, or update VITE_SINGLE_USER_PASSWORD.'
    )
  }
  if (m.includes('email not confirmed')) {
    return (
      'Email not confirmed. In Supabase: Authentication → Providers → Email → turn off "Confirm email", ' +
      'or confirm the user under Authentication → Users.'
    )
  }
  return message
}

async function ensureSingleUserSession(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession()
  if (sessionData.session) return

  const email = envCredential('VITE_SINGLE_USER_EMAIL')
  const password = envCredential('VITE_SINGLE_USER_PASSWORD')

  if (!email || !password) {
    throw new Error('Set VITE_SINGLE_USER_EMAIL and VITE_SINGLE_USER_PASSWORD in .env')
  }

  const signIn = await supabase.auth.signInWithPassword({ email, password })
  if (!signIn.error) return

  const signInMsg = signIn.error.message.toLowerCase()

  if (signInMsg.includes('email not confirmed')) {
    throw new Error(normalizeAuthError(signIn.error.message))
  }

  const canTrySignUp =
    signInMsg.includes('invalid login credentials') || signInMsg.includes('invalid credentials')

  if (!canTrySignUp) {
    throw new Error(normalizeAuthError(signIn.error.message))
  }

  const signUp = await supabase.auth.signUp({ email, password })
  if (!signUp.error) {
    if (signUp.data.session) return

    const retry = await supabase.auth.signInWithPassword({ email, password })
    if (!retry.error) return

    if (signUp.data.user && !signUp.data.session) {
      throw new Error(
        'Account may need email confirmation. Turn off "Confirm email" in Supabase Auth → Providers → Email, then restart.',
      )
    }
    if (retry.error) throw new Error(normalizeAuthError(retry.error.message))
    return
  }

  throw new Error(normalizeAuthError(signUp.error.message))
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    void (async () => {
      try {
        await ensureSingleUserSession()
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        setSession(data.session)
        setAuthError(null)
        if (data.session) {
          prefetchCommonAppData()
          void seedDefaultBusinessData().catch(() => {
            // Master data may already exist
          })
        }
      } catch (err) {
        if (!mounted) return
        const raw = err instanceof Error ? err.message : 'Could not start app session'
        setAuthError(normalizeAuthError(raw))
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      authError,
    }),
    [session, loading, authError],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
