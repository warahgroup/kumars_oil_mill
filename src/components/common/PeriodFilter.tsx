import type { PeriodFilter } from '@/lib/dateRangeFilter'

type Props = {
  value: PeriodFilter
  onChange: (v: PeriodFilter) => void
}

function chipClass(active: boolean): string {
  const base =
    'min-h-10 rounded-xl border-2 px-4 py-2 text-sm font-bold transition active:scale-[0.98]'
  if (active) return `${base} border-accent-400 bg-accent-300/25 text-brand-900 shadow-sm`
  return `${base} border-brand-100 bg-surface-elevated text-slate-200 hover:border-brand-500`
}

const OPTIONS: { id: PeriodFilter; label: string }[] = [
  { id: 'day', label: 'Today' },
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'This month' },
]

export function PeriodFilterChips({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {OPTIONS.map((o) => (
        <button key={o.id} type="button" className={chipClass(value === o.id)} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}
