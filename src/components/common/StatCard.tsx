import { Card } from '@/components/ui/Card'

type StatCardProps = {
  label: string
  value: string
  highlight?: boolean
  accent?: 'gold' | 'none'
}

export function StatCard({ label, value, highlight, accent = 'none' }: StatCardProps) {
  return (
    <Card
      className={`${highlight ? 'ring-2 ring-brand-500/40' : ''} ${accent === 'gold' ? 'border-accent-400/50' : ''}`}
      padding="lg"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 md:text-sm">{label}</p>
      <p
        className={`mt-2 font-bold text-slate-100 ${highlight ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'}`}
      >
        {value}
      </p>
    </Card>
  )
}
