import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

type ConfirmPanelProps = {
  title: string
  description?: string
  confirmLabel: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
  loading?: boolean
}

export function ConfirmPanel({
  title,
  description,
  confirmLabel,
  cancelLabel = 'Go back',
  onConfirm,
  onCancel,
  loading,
}: ConfirmPanelProps) {
  return (
    <Card padding="lg" className="border-2 border-accent-400/40">
      <h2 className="text-lg font-bold text-brand-900">{title}</h2>
      {description ? <p className="mt-2 text-sm text-slate-600">{description}</p> : null}
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" fullWidth onClick={onCancel} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button fullWidth size="lg" onClick={onConfirm} disabled={loading}>
          {loading ? 'Saving…' : confirmLabel}
        </Button>
      </div>
    </Card>
  )
}
