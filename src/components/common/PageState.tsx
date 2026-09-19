import { Button } from '@/components/ui/Button'

type PageStateProps =
  | { status: 'loading'; label?: string }
  | { status: 'empty'; title: string; description?: string }
  | { status: 'error'; message: string; onRetry?: () => void }

export function PageState(props: PageStateProps) {
  if (props.status === 'loading') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-brand-100 bg-surface-elevated p-4 text-sm text-slate-300">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-200 border-t-accent-400" />
        {props.label ?? 'Loading…'}
      </div>
    )
  }

  if (props.status === 'error') {
    return (
      <div className="rounded-2xl border border-red-800 bg-red-950/50 p-5">
        <p className="font-semibold text-red-200">Could not load this page</p>
        <p className="mt-1 text-sm text-red-300">{props.message}</p>
        {props.onRetry ? (
          <Button className="mt-4" variant="secondary" onClick={props.onRetry}>
            Try again
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-dashed border-brand-200 bg-surface-elevated p-8 text-center">
      <p className="text-lg font-semibold text-slate-100">{props.title}</p>
      {props.description ? <p className="mt-2 text-sm text-slate-400">{props.description}</p> : null}
    </div>
  )
}
