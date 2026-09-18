import { Link } from 'react-router-dom'
import { HistoryTable } from '@/components/common/HistoryTable'
import { PageShell } from '@/components/common/PageShell'
import { PageState } from '@/components/common/PageState'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/format'
import { useQuery } from '@/hooks/useQuery'
import { listBottling } from '@/services/bottlingService'

export default function BottlePage() {
  const { state, reload } = useQuery(() => listBottling(), [])

  return (
    <PageShell
      title="Bottle"
      subtitle="Oil packed into bottles"
      action={<Link to="/bottle/new"><Button size="lg">+ Bottle oil</Button></Link>}
    >
      {state.status === 'loading' ? <PageState status="loading" label="Loading…" /> : null}
      {state.status === 'error' ? <PageState status="error" message={state.message} onRetry={reload} /> : null}
      {state.status === 'success' ? (
        <HistoryTable
          rows={state.data}
          emptyMessage="No bottling yet."
          columns={[
            { key: 'product', header: 'Product', primary: true, render: (r) => `${r.package?.product?.name ?? ''} ${r.package?.label ?? ''}`.trim() },
            { key: 'date', header: 'Date', render: (r) => formatDate(r.transaction_date) },
            { key: 'count', header: 'Bottles', render: (r) => r.package_count },
            { key: 'oil', header: 'Oil used (L)', render: (r) => Number(r.bulk_litres_used).toFixed(2) },
            { key: 'cost', header: 'Packaging', render: (r) => formatCurrency(r.packaging_cost_total) },
          ]}
        />
      ) : null}
    </PageShell>
  )
}
