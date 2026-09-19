type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<Tone, string> = {
  neutral: 'bg-brand-100 text-slate-200',
  success: 'bg-green-900/60 text-green-200 ring-1 ring-green-700',
  warning: 'bg-amber-900/50 text-amber-200 ring-1 ring-amber-700',
  danger: 'bg-red-900/50 text-red-200 ring-1 ring-red-700',
  info: 'bg-brand-200/40 text-sky-200 ring-1 ring-brand-300',
}

export function StatusBadge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {children}
    </span>
  )
}
