import { useState } from 'react'
import { PageShell } from '@/components/common/PageShell'
import { PageState } from '@/components/common/PageState'
import { Card } from '@/components/ui/Card'
import { Tabs } from '@/components/ui/Tabs'
import { formatCurrency, formatDate } from '@/lib/format'
import { useQuery } from '@/hooks/useQuery'
import {
  reportCashFlow,
  reportExpiry,
  reportExpenses,
  reportProduction,
  reportProfit,
  reportPurchases,
  reportSales,
  reportStockSnapshot,
} from '@/services/reportsService'

const tabs = [
  { id: 'sales', label: 'Sales' },
  { id: 'purchases', label: 'Purchases' },
  { id: 'production', label: 'Production' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'stock', label: 'Stock' },
  { id: 'expiry', label: 'Expiry' },
  { id: 'profit', label: 'Profit' },
  { id: 'cashflow', label: 'Cash Flow' },
]

export default function ReportsPage() {
  const [active, setActive] = useState('sales')
  const { state, reload } = useQuery(async () => {
    const [sales, purchases, production, expenses, stock, expiry, profit, cashflow] =
      await Promise.all([
        reportSales(),
        reportPurchases(),
        reportProduction(),
        reportExpenses(),
        reportStockSnapshot(),
        reportExpiry(),
        reportProfit(),
        reportCashFlow(),
      ])
    return { sales, purchases, production, expenses, stock, expiry, profit, cashflow }
  }, [])

  return (
    <PageShell title="Profit & reports" subtitle="See how your business is doing">
      {state.status === 'loading' ? <PageState status="loading" label="Loading reports…" /> : null}
      {state.status === 'error' ? <PageState status="error" message={state.message} onRetry={reload} /> : null}
      {state.status === 'success' ? (
        <ReportsContent data={state.data} active={active} setActive={setActive} />
      ) : null}
    </PageShell>
  )
}

function ReportsContent({
  data,
  active,
  setActive,
}: {
  data: {
    sales: Awaited<ReturnType<typeof reportSales>>
    purchases: Awaited<ReturnType<typeof reportPurchases>>
    production: Awaited<ReturnType<typeof reportProduction>>
    expenses: Awaited<ReturnType<typeof reportExpenses>>
    stock: Awaited<ReturnType<typeof reportStockSnapshot>>
    expiry: Awaited<ReturnType<typeof reportExpiry>>
    profit: Awaited<ReturnType<typeof reportProfit>>
    cashflow: Awaited<ReturnType<typeof reportCashFlow>>
  }
  active: string
  setActive: (id: string) => void
}) {
  return (
    <div>
      <Tabs tabs={tabs} active={active} onChange={setActive} />

      {active === 'sales' && (
        <Card className="max-h-96 overflow-y-auto text-sm">
          {data.sales.map((s) => (
            <div key={s.id} className="flex justify-between border-b border-slate-100 py-2">
              <span>{s.reference_no ?? s.id.slice(0, 8)} · {formatDate(s.sale_date)}</span>
              <span>{formatCurrency(Number(s.total_amount))}</span>
            </div>
          ))}
        </Card>
      )}

      {active === 'purchases' && (
        <Card className="max-h-96 overflow-y-auto text-sm">
          {data.purchases.map((p) => (
            <div key={p.id} className="flex justify-between border-b py-2">
              <span>{formatDate(p.transaction_date)} · {(p.supplier as { name?: string } | null)?.name ?? 'Supplier'}</span>
              <span>{formatCurrency(Number(p.total_amount))}</span>
            </div>
          ))}
        </Card>
      )}

      {active === 'production' && (
        <Card className="max-h-96 overflow-y-auto text-sm">
          {data.production.map((p) => (
            <div key={p.id} className="flex justify-between border-b py-2">
              <span>{(p.product as { name?: string } | null)?.name} · {formatDate(p.production_date)}</span>
              <span>{Number(p.oil_output_litres).toFixed(1)} L</span>
            </div>
          ))}
        </Card>
      )}

      {active === 'expenses' && (
        <Card className="max-h-96 overflow-y-auto text-sm">
          {data.expenses.map((e) => (
            <div key={e.id} className="flex justify-between border-b py-2">
              <span>{(e.category as { name?: string } | null)?.name} · {formatDate(e.expense_date)}</span>
              <span>{formatCurrency(Number(e.amount))}</span>
            </div>
          ))}
        </Card>
      )}

      {active === 'stock' && (
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <h3 className="font-semibold mb-2">Raw materials</h3>
            {data.stock.materials.map((m) => (
              <p key={m.id} className="text-sm flex justify-between">
                <span>{m.name}</span>
                <span>{(data.stock.rawTotals.get(m.id) ?? 0).toFixed(2)} {m.unit}</span>
              </p>
            ))}
          </Card>
          <Card>
            <h3 className="font-semibold mb-2">Bulk remaining</h3>
            {data.stock.productionBatches.filter((b) => Number(b.remaining_bulk_litres) > 0).map((b) => (
              <p key={b.id} className="text-sm flex justify-between">
                <span>{data.stock.products.find((p) => p.id === b.output_product_id)?.name}</span>
                <span>{Number(b.remaining_bulk_litres).toFixed(1)} L</span>
              </p>
            ))}
          </Card>
        </div>
      )}

      {active === 'expiry' && (
        <Card className="text-sm space-y-2">
          {data.expiry.map((a) => (
            <div key={`${a.kind}-${a.id}`} className="flex justify-between border-b py-2">
              <span>{a.label}</span>
              <span>{a.daysLeft < 0 ? 'Expired' : `${a.daysLeft} days · ${formatDate(a.expiry_date)}`}</span>
            </div>
          ))}
        </Card>
      )}

      {active === 'profit' && (
        <Card className="space-y-2 text-sm">
          <p className="flex justify-between"><span>Sales</span><span>{formatCurrency(data.profit.revenue)}</span></p>
          <p className="flex justify-between"><span>Cost of goods sold</span><span>{formatCurrency(data.profit.cogs)}</span></p>
          <p className="flex justify-between font-semibold"><span>Profit before expenses</span><span>{formatCurrency(data.profit.grossProfit)}</span></p>
          <p className="flex justify-between"><span>Expenses</span><span>{formatCurrency(data.profit.operatingExpenses)}</span></p>
          <p className="flex justify-between text-base font-bold"><span>Net profit</span><span>{formatCurrency(data.profit.netProfit)}</span></p>
        </Card>
      )}

      {active === 'cashflow' && (
        <Card className="max-h-96 overflow-y-auto text-sm">
          {data.cashflow.map((t) => (
            <div key={t.id} className="flex justify-between border-b py-2">
              <span>{formatDate(t.transaction_date)} · {(t.account as { name?: string } | null)?.name}</span>
              <span className={t.direction === 'in' ? 'text-green-700' : 'text-red-700'}>
                {t.direction === 'in' ? '+' : '-'}{formatCurrency(Number(t.amount))}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
