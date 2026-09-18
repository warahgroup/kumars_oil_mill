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
      className={`${highlight ? 'ring-2 ring-brand-200' : ''} ${accent === 'gold' ? 'border-accent-400/50' : ''}`}
      padding="lg"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 md:text-sm">{label}</p>
      <p
        className={`mt-2 font-bold text-brand-900 ${highlight ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'}`}
      >
        {value}
      </p>
    </Card>
  )
}
