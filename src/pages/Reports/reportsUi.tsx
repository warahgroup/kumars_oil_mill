import { useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { formatCurrency } from '@/lib/format'

export function ReportDivider() {
  return <hr className="border-brand-100" />
}

type MetricProps = {
  title: string
  value: string
  hint: string
  accent?: boolean
  children?: ReactNode
}

export function ReportMetric({ title, value, hint, accent, children }: MetricProps) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-accent-500' : 'text-brand-900'}`}>{value}</p>
      <p className="text-sm text-slate-600">{hint}</p>
      {children}
    </div>
  )
}

export function ReportSection({
  id,
  icon,
  title,
  summary,
  children,
}: {
  id: string
  icon: string
  title: string
  summary?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden>{icon}</span>
        <div>
          <h2 className="text-lg font-bold text-brand-900">{title}</h2>
          {summary}
        </div>
      </div>
      <Card className="space-y-4">{children}</Card>
    </section>
  )
}

export function SimpleRow({
  left,
  right,
  sub,
}: {
  left: string
  right: string
  sub?: string
}) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-0">
      <div className="flex items-start justify-between gap-3">
        <span className="font-medium text-brand-900">{left}</span>
        <span className="font-semibold text-brand-900">{right}</span>
      </div>
      {sub ? <p className="mt-1 text-sm text-slate-600">{sub}</p> : null}
    </div>
  )
}

export function HowCalculated({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-dashed border-brand-200 bg-brand-100/20 p-3">
      <button
        type="button"
        className="text-sm font-semibold text-slate-200"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide' : 'How is this calculated?'}
      </button>
      {open ? <div className="mt-2 space-y-1 text-sm text-slate-300">{children}</div> : null}
    </div>
  )
}

export function MoneyLine({ label, amount, bold }: { label: string; amount: number; bold?: boolean }) {
  return (
    <p className={`flex justify-between gap-4 ${bold ? 'font-bold text-slate-100' : 'text-slate-300'}`}>
      <span>{label}</span>
      <span>{formatCurrency(amount)}</span>
    </p>
  )
}

export function OverviewNavCard({
  icon,
  title,
  value,
  line,
  onClick,
}: {
  icon: string
  title: string
  value: string
  line: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[5.5rem] flex-col items-start rounded-2xl border-2 border-brand-100 bg-surface-elevated p-4 text-left shadow-sm transition hover:border-accent-400 active:scale-[0.99]"
    >
      <span className="text-xl" aria-hidden>{icon}</span>
      <span className="mt-1 text-sm font-bold uppercase text-slate-500">{title}</span>
      <span className="text-lg font-bold text-brand-900">{value}</span>
      <span className="mt-1 text-xs text-slate-600">{line}</span>
    </button>
  )
}
