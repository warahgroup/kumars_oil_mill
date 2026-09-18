import { Outlet } from 'react-router-dom'
import { PageState } from '@/components/common/PageState'
import { Alert } from '@/components/ui/Alert'
import { useAuth } from '@/hooks/useAuth'

export function ProtectedRoute() {
  const { loading, authError, user } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <PageState status="loading" label="Starting your mill app…" />
      </div>
    )
  }

  if (authError || !user) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <Alert variant="error" title="Cannot connect">
          {authError ?? 'No active session. Check your .env Supabase and single-user credentials.'}
        </Alert>
      </div>
    )
  }

  return <Outlet />
}
