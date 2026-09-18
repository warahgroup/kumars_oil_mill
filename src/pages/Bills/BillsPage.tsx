import { Link } from 'react-router-dom'
import { HistoryTable } from '@/components/common/HistoryTable'
import { PageShell } from '@/components/common/PageShell'
import { PageState } from '@/components/common/PageState'
import { formatCurrency, formatDate } from '@/lib/format'
import { useQuery } from '@/hooks/useQuery'
import { listSales } from '@/services/salesService'

export default function BillsPage() {
  const { state, reload } = useQuery(() => listSales(), [])

  return (
    <PageShell title="Bills" subtitle="Sales receipts">
      {state.status === 'loading' ? <PageState status="loading" label="Loading bills…" /> : null}
      {state.status === 'error' ? <PageState status="error" message={state.message} onRetry={reload} /> : null}
      {state.status === 'success' ? (
      <HistoryTable
        rows={state.data}
        emptyMessage="No bills yet."
        columns={[
          {
            key: 'bill',
            header: 'Bill',
            primary: true,
            render: (r) => (
              <Link className="font-medium text-brand-700" to={`/bills/${r.id}`}>
                {r.reference_no ?? r.id.slice(0, 8)}
              </Link>
            ),
          },
          { key: 'date', header: 'Date', render: (r) => formatDate(r.sale_date) },
          { key: 'total', header: 'Total', render: (r) => formatCurrency(r.total_amount) },
        ]}
      />
      ) : null}
    </PageShell>
  )
}
