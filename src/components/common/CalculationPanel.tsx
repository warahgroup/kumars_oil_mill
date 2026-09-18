import { Card } from '@/components/ui/Card'

type Line = { label: string; value: string; emphasis?: boolean }

export function CalculationPanel({ title, lines }: { title?: string; lines: Line[] }) {
  return (
    <Card className="border-brand-200 bg-brand-50/60">
      {title ? <p className="mb-3 text-sm font-semibold text-brand-800">{title}</p> : null}
      <dl className="space-y-2">
        {lines.map((line) => (
          <div key={line.label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-slate-600">{line.label}</dt>
            <dd className={`text-right font-semibold ${line.emphasis ? 'text-lg text-brand-900' : 'text-brand-900'}`}>
              {line.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}
