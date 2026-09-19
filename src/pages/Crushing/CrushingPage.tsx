import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageShell } from '@/components/common/PageShell'
import { PageState } from '@/components/common/PageState'
import { PeriodFilterChips } from '@/components/common/PeriodFilter'
import { formatCurrency, formatDate } from '@/lib/format'
import { isDateInRange, periodDateRange, type PeriodFilter } from '@/lib/dateRangeFilter'
import { useQuery } from '@/hooks/useQuery'
import { crushingCustomerDisplayName, listCrushing, type CrushingRow } from '@/services/crushingService'

function settlementLabel(row: CrushingRow): string {
  if (row.settlement_direction === 'settled') return 'Settled (₹0)'
  if (row.settlement_direction === 'mill_pays_customer') {
    return `Mill pays customer ${formatCurrency(row.net_settlement_amount)}`
  }
  return `Customer paid ${formatCurrency(row.net_settlement_amount)}`
}

export default function CrushingPage() {
  const [period, setPeriod] = useState<PeriodFilter>('month')
  const [search, setSearch] = useState('')
  const { state, reload } = useQuery(() => listCrushing(), [])

  const { from, to } = periodDateRange(period)

  const rows = useMemo(() => {
    if (state.status !== 'success') return []
    const q = search.trim().toLowerCase()
    return state.data.filter((r) => {
      if (!isDateInRange(r.crushing_date, from, to)) return false
      if (!q) return true
      const name = crushingCustomerDisplayName(r.customer?.name)?.toLowerCase() ?? ''
      const mat = r.raw_material?.name?.toLowerCase() ?? ''
      const code = r.transaction_code?.toLowerCase() ?? ''
      return name.includes(q) || mat.includes(q) || code.includes(q)
    })
  }, [state, from, to, search])

  return (
    <PageShell title="Crushing" subtitle="Customer material crushing service">
      <div className="space-y-4">
        <Link
          to="/crushing/new"
          className="flex min-h-14 w-full items-center justify-center rounded-2xl bg-action-crushing text-base font-bold text-white shadow-md transition active:scale-[0.98]"
        >
          + New crushing
        </Link>

        <Input
          label="Search"
          placeholder="Material or job code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {state.status === 'loading' ? <PageState status="loading" label="Loading…" /> : null}
        {state.status === 'error' ? (
          <PageState
            status="error"
            message={
              state.message.includes('crushing_transactions')
                ? 'Crushing database not ready. Run Supabase migrations 20260322000004 and 20260322000005, then reload.'
                : state.message
            }
            onRetry={reload}
          />
        ) : null}

        {state.status === 'success' ? (
          <>
            <div className="space-y-3">
              {rows.length === 0 ? (
                <p className="text-sm text-slate-600">No crushing jobs in this period.</p>
              ) : (
                rows.map((r) => (
                  <Link key={r.id} to={`/crushing/${r.id}`}>
                    <Card className="space-y-2 transition hover:border-brand-300">
                      <p className="text-lg font-bold text-brand-900">
                        {r.input_quantity} {r.raw_material?.unit ?? 'kg'} {r.raw_material?.name}
                      </p>
                      {crushingCustomerDisplayName(r.customer?.name) ? (
                        <p className="text-sm text-slate-400">{crushingCustomerDisplayName(r.customer?.name)}</p>
                      ) : null}
                      <p className="text-sm">
                        {r.oil_output_quantity} L oil returned · {r.cake_output_quantity} kg cake
                      </p>
                      <p className="text-sm text-slate-600">
                        Cake:{' '}
                        {r.cake_handling === 'customer_takes' ? 'Customer took it' : 'Sold to mill'}
                      </p>
                      <p className="text-sm">
                        Crushing charge: {formatCurrency(r.crushing_charge)}
                        {r.cake_purchase_value > 0
                          ? ` · Cake value: ${formatCurrency(r.cake_purchase_value)}`
                          : ''}
                      </p>
                      <p className="font-semibold text-brand-900">{settlementLabel(r)}</p>
                      <p className="text-xs text-slate-500">{formatDate(r.crushing_date)}</p>
                    </Card>
                  </Link>
                ))
              )}
            </div>

            <section className="space-y-2 border-t border-brand-100 pt-4">
              <h2 className="font-bold text-brand-900">History filter</h2>
              <PeriodFilterChips value={period} onChange={setPeriod} />
            </section>
          </>
        ) : null}
      </div>
    </PageShell>
  )
}
