import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageShell } from '@/components/common/PageShell'
import { QuickActionButton } from '@/components/common/QuickActionButton'
import { StatCard } from '@/components/common/StatCard'
import { PageState } from '@/components/common/PageState'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatCurrency } from '@/lib/format'
import { loadDashboard, type DashboardData } from '@/services/dashboardService'

export default function HomePage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [dashError, setDashError] = useState<string | null>(null)

  useEffect(() => {
    void loadDashboard()
      .then(setDashboard)
      .catch((e) => setDashError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  const d = dashboard

  return (
    <PageShell title="Home" subtitle="Your business today">
      <section className="grid gap-3 sm:grid-cols-3">
        {!d ? (
          <>
            <PageState status="loading" label="Loading sales…" />
            <PageState status="loading" label="Loading profit…" />
            <PageState status="loading" label="Loading expenses…" />
          </>
        ) : (
          <>
            <StatCard label="Today's Sales" value={formatCurrency(d.todaySales)} highlight accent="gold" />
            <StatCard label="Today's Profit" value={formatCurrency(d.todayNetProfit)} highlight />
            <StatCard label="Today's Expenses" value={formatCurrency(d.todayExpenses)} highlight />
          </>
        )}
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-700">Money</h2>
        <div className="grid grid-cols-3 gap-2 md:gap-3">
          {!d ? (
            <PageState status="loading" label="Loading balances…" />
          ) : (
            <>
              <StatCard label="Cash" value={formatCurrency(d.balances.cash)} />
              <StatCard label="UPI" value={formatCurrency(d.balances.upi)} />
              <StatCard label="Bank" value={formatCurrency(d.balances.bank)} />
            </>
          )}
        </div>
      </section>

      {d ? (
        <section className="mt-5">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-700">Today&apos;s crushing</h2>
          <Link to="/crushing">
          <Card className="grid gap-1 text-sm sm:grid-cols-2 transition active:scale-[0.99] hover:border-brand-500">
            <p>{d.todayCrushing.customers} customers</p>
            <p>{d.todayCrushing.kgCrushed} kg crushed</p>
            <p>{d.todayCrushing.oilReturned} L oil returned</p>
            <p className="font-semibold text-action-crushing">
              {formatCurrency(d.todayCrushing.crushingIncome)} crushing income
            </p>
          </Card>
          </Link>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-brand-700">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <QuickActionButton to="/sell/new" label="SELL" kind="sales" />
          <QuickActionButton to="/produce/new" label="PRODUCE" kind="production" />
          <QuickActionButton to="/crushing" label="CRUSHING" kind="crushing" />
          <QuickActionButton to="/buy" label="BUY" kind="purchase" />
          <QuickActionButton to="/expense" label="EXPENSE" kind="expense" />
        </div>
      </section>

      {dashError ? (
        <div className="mt-4">
          <PageState status="error" message={dashError} onRetry={() => window.location.reload()} />
        </div>
      ) : null}

      {d ? (
        <section className="mt-8 grid gap-4 md:grid-cols-2">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-bold text-brand-900">Stock alerts</h2>
              <Link to="/stock" className="text-sm font-semibold text-brand-600">View stock</Link>
            </div>
            {d.lowStock.length === 0 ? (
              <p className="text-sm text-slate-500">Stock levels look fine.</p>
            ) : (
              <ul className="space-y-2">
                {d.lowStock.map((item) => (
                  <li key={item.raw_material_id} className="flex justify-between text-sm">
                    <span>{d.materialNames.get(item.raw_material_id) ?? 'Material'}</span>
                    <StatusBadge tone="warning">{item.quantity} {item.unit}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 font-bold text-brand-900">Expiry alerts</h2>
            {d.expiryAlerts.length === 0 ? (
              <p className="text-sm text-slate-500">No expiry issues right now.</p>
            ) : (
              <ul className="max-h-52 space-y-2 overflow-y-auto">
                {d.expiryAlerts.slice(0, 10).map((a) => (
                  <li key={`${a.kind}-${a.id}`} className="flex justify-between gap-2 text-sm">
                    <span className="text-brand-900">{a.label}</span>
                    <StatusBadge tone={a.daysLeft < 0 ? 'danger' : a.daysLeft <= 7 ? 'warning' : 'info'}>
                      {a.daysLeft < 0 ? 'Expired' : `${a.daysLeft} days`}
                    </StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      ) : null}
    </PageShell>
  )
}
