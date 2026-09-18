import { Link } from 'react-router-dom'
import { PageShell } from '@/components/common/PageShell'
import { moreNav } from '@/components/layout/navConfig'
import { Card } from '@/components/ui/Card'

export default function MorePage() {
  return (
    <PageShell title="More" subtitle="Purchase, bills, profit, and settings">
      <div className="grid gap-3 sm:grid-cols-2">
        {moreNav.map((item) => (
          <Link key={item.to} to={item.to}>
            <Card className="min-h-16 transition active:scale-[0.99] hover:border-brand-300 hover:shadow-md">
              <p className="text-base font-bold text-brand-900">{item.label}</p>
              {item.shortLabel ? (
                <p className="mt-1 text-sm text-slate-500">{item.shortLabel}</p>
              ) : null}
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  )
}
