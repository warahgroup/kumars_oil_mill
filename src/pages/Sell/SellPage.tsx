import { Link } from 'react-router-dom'
import { HistoryTable } from '@/components/common/HistoryTable'
import { PageShell } from '@/components/common/PageShell'
import { PageState } from '@/components/common/PageState'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/format'
import { useQuery } from '@/hooks/useQuery'
import { listSales } from '@/services/salesService'

export default function SellPage() {
  const { state, reload } = useQuery(() => listSales(), [])

  return (
    <PageShell
      title="Sales"
      subtitle="Money received from customers"
      action={
        <Link to="/sell/new">
          <Button className="bg-action-sales" size="lg">+ New sale</Button>
        </Link>
      }
    >
      {state.status === 'loading' ? <PageState status="loading" label="Loading sales…" /> : null}
      {state.status === 'error' ? <PageState status="error" message={state.message} onRetry={reload} /> : null}
      {state.status === 'success' ? (
        <HistoryTable
          rows={state.data}
          emptyMessage="No sales yet."
          columns={[
            { key: 'bill', header: 'Bill', primary: true, render: (r) => r.reference_no ?? r.id.slice(0, 8) },
            { key: 'date', header: 'Date', render: (r) => formatDate(r.sale_date) },
            { key: 'customer', header: 'Customer', render: (r) => r.customer?.name ?? 'Walk-in' },
            { key: 'total', header: 'Total', render: (r) => formatCurrency(r.total_amount) },
          ]}
        />
      ) : null}
    </PageShell>
  )
}
