import { Link } from 'react-router-dom'
import { HistoryTable } from '@/components/common/HistoryTable'
import { PageShell } from '@/components/common/PageShell'
import { PageState } from '@/components/common/PageState'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/format'
import { useQuery } from '@/hooks/useQuery'
import { listProductions } from '@/services/productionService'

export default function ProducePage() {
  const { state, reload } = useQuery(() => listProductions(), [])

  return (
    <PageShell
      title="Production"
      subtitle="Oil you produced"
      action={
        <Link to="/produce/new">
          <Button className="bg-action-production" size="lg">+ New production</Button>
        </Link>
      }
    >
      {state.status === 'loading' ? <PageState status="loading" label="Loading production…" /> : null}
      {state.status === 'error' ? <PageState status="error" message={state.message} onRetry={reload} /> : null}
      {state.status === 'success' ? (
        <HistoryTable
          rows={state.data}
          emptyMessage="No production batches yet."
          columns={[
            { key: 'product', header: 'Product', primary: true, render: (r) => r.product?.name ?? '—' },
            { key: 'date', header: 'Date', render: (r) => formatDate(r.production_date) },
            { key: 'oil', header: 'Oil (L)', render: (r) => Number(r.oil_output_litres).toFixed(2) },
            { key: 'cost', header: 'Cost/L', render: (r) => formatCurrency(Number(r.cost_per_litre)) },
          ]}
        />
      ) : null}
    </PageShell>
  )
}
