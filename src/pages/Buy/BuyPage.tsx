import { Link } from 'react-router-dom'
import { HistoryTable } from '@/components/common/HistoryTable'
import { PageShell } from '@/components/common/PageShell'
import { PageState } from '@/components/common/PageState'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/format'
import { useQuery } from '@/hooks/useQuery'
import { listPurchases } from '@/services/purchaseService'

export default function BuyPage() {
  const { state, reload } = useQuery(() => listPurchases(), [])

  return (
    <PageShell
      title="Purchase"
      subtitle="Materials you bought"
      action={
        <Link to="/buy/new">
          <Button className="bg-action-purchase text-brand-900" size="lg">+ New purchase</Button>
        </Link>
      }
    >
      {state.status === 'loading' ? <PageState status="loading" label="Loading purchases…" /> : null}
      {state.status === 'error' ? <PageState status="error" message={state.message} onRetry={reload} /> : null}
      {state.status === 'success' ? (
        <HistoryTable
          rows={state.data}
          emptyMessage="No purchases yet. Tap New purchase to add one."
          columns={[
            { key: 'date', header: 'Date', primary: true, render: (r) => formatDate(r.transaction_date) },
            { key: 'supplier', header: 'Supplier', render: (r) => r.supplier?.name ?? '—' },
            { key: 'amount', header: 'Amount', render: (r) => formatCurrency(r.total_amount) },
            { key: 'pay', header: 'Payment', render: (r) => r.financial_account?.name ?? '—' },
          ]}
        />
      ) : null}
    </PageShell>
  )
}
