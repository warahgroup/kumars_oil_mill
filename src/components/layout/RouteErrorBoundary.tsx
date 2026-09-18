import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

export function RouteErrorElement({ title }: { title: string }) {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? error.statusText || error.data?.toString()
    : error instanceof Error
      ? error.message
      : 'Unexpected error'

  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-red-700">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">{message}</p>
      <Button className="mt-4" variant="secondary" onClick={() => window.location.reload()}>
        Reload page
      </Button>
    </div>
  )
}
