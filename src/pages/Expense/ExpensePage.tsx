import { Link } from 'react-router-dom'
import { HistoryTable } from '@/components/common/HistoryTable'
import { PageShell } from '@/components/common/PageShell'
import { PageState } from '@/components/common/PageState'
import { Button } from '@/components/ui/Button'
import { formatCurrency, formatDate } from '@/lib/format'
import { useQuery } from '@/hooks/useQuery'
import { listExpenses } from '@/services/expenseService'

export default function ExpensePage() {
  const { state, reload } = useQuery(() => listExpenses(), [])

  return (
    <PageShell
      title="Expenses"
      subtitle="Money spent on running the mill"
      action={
        <Link to="/expense/new">
          <Button className="bg-action-expense" size="lg">+ New expense</Button>
        </Link>
      }
    >
      {state.status === 'loading' ? <PageState status="loading" label="Loading expenses…" /> : null}
      {state.status === 'error' ? <PageState status="error" message={state.message} onRetry={reload} /> : null}
      {state.status === 'success' ? (
        <HistoryTable
          rows={state.data}
          emptyMessage="No expenses recorded yet."
          columns={[
            { key: 'date', header: 'Date', primary: true, render: (r) => formatDate(r.expense_date) },
            { key: 'cat', header: 'Category', render: (r) => r.category?.name ?? '—' },
            { key: 'amount', header: 'Amount', render: (r) => formatCurrency(r.amount) },
            { key: 'pay', header: 'Payment', render: (r) => r.account?.name ?? '—' },
          ]}
        />
      ) : null}
    </PageShell>
  )
}
