import { useMemo, useState } from 'react'
import { PageShell } from '@/components/common/PageShell'
import { PageState } from '@/components/common/PageState'
import { Input } from '@/components/ui/Input'
import { formatCurrency, formatDate } from '@/lib/format'
import { localIsoDate } from '@/lib/dateRangeFilter'
import {
  resolveReportDateRange,
  type ReportDatePreset,
} from '@/lib/reportDateRange'
import { useQuery } from '@/hooks/useQuery'
import { loadReportsBundle, type ReportsBundle } from '@/services/reportsDataService'
import {
  HowCalculated,
  MoneyLine,
  OverviewNavCard,
  ReportDivider,
  ReportMetric,
  ReportSection,
  SimpleRow,
} from '@/pages/Reports/reportsUi'

const PRESETS: { id: ReportDatePreset; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'month', label: 'This month' },
  { id: 'custom', label: 'Custom' },
]

function chipClass(active: boolean): string {
  const base = 'min-h-10 rounded-xl border-2 px-3 py-2 text-sm font-bold'
  return active
    ? `${base} border-accent-400 bg-accent-300/30 text-brand-900`
    : `${base} border-brand-100 bg-white text-brand-800`
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function ReportsPage() {
  const [preset, setPreset] = useState<ReportDatePreset>('month')
  const [customFrom, setCustomFrom] = useState(() => localIsoDate())
  const [customTo, setCustomTo] = useState(() => localIsoDate())

  const range = useMemo(
    () => resolveReportDateRange(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  )

  const { state, reload } = useQuery(() => loadReportsBundle(range), [range.from, range.to])

  return (
    <PageShell title="Reports" subtitle="See what happened in your business">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-brand-800">Date</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={chipClass(preset === p.id)}
                onClick={() => setPreset(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="From" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <Input label="To" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          ) : (
            <p className="text-sm text-slate-600">Showing: {range.label}</p>
          )}
        </div>

        {state.status === 'loading' ? <PageState status="loading" label="Loading reports…" /> : null}
        {state.status === 'error' ? (
          <PageState status="error" message="Could not load this report." onRetry={reload} />
        ) : null}

        {state.status === 'success' ? <ReportsBody data={state.data} /> : null}
      </div>
    </PageShell>
  )
}

function ReportsBody({ data }: { data: ReportsBundle }) {
  const d = data
  const fmtL = (n: number) => `${n % 1 === 0 ? n : n.toFixed(1)} L`

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <OverviewNavCard
          icon="🛒"
          title="Sales"
          value={formatCurrency(d.sales.totalSales)}
          line={`You sold ${formatCurrency(d.sales.totalSales)}`}
          onClick={() => scrollTo('report-sales')}
        />
        <OverviewNavCard
          icon="🌾"
          title="Purchases"
          value={formatCurrency(d.purchases.totalPaid)}
          line="Money paid for materials"
          onClick={() => scrollTo('report-purchases')}
        />
        <OverviewNavCard
          icon="🏭"
          title="Production"
          value={fmtL(d.production.totalOilLitres)}
          line={`${d.production.batchCount} batches`}
          onClick={() => scrollTo('report-production')}
        />
        <OverviewNavCard
          icon="🫒"
          title="Crushing"
          value={formatCurrency(d.crushing.crushingIncome)}
          line={`${d.crushing.customersServed} customers served`}
          onClick={() => scrollTo('report-crushing')}
        />
        <OverviewNavCard
          icon="💸"
          title="Expenses"
          value={formatCurrency(d.expenses.total)}
          line="Running the mill"
          onClick={() => scrollTo('report-expenses')}
        />
        <OverviewNavCard
          icon="📦"
          title="Stock"
          value={`${d.stock.totalUnits}`}
          line="Units in stock now"
          onClick={() => scrollTo('report-stock')}
        />
        <OverviewNavCard
          icon="⏰"
          title="Expiry"
          value={String(d.expiry.needAttention)}
          line="Need attention"
          onClick={() => scrollTo('report-expiry')}
        />
        <OverviewNavCard
          icon="💰"
          title="Profit"
          value={formatCurrency(d.profit.netProfit)}
          line="After product cost & expenses"
          onClick={() => scrollTo('report-profit')}
        />
        <OverviewNavCard
          icon="🏦"
          title="Money"
          value={formatCurrency(d.money.total)}
          line="Cash + UPI + Bank"
          onClick={() => scrollTo('report-money')}
        />
      </div>

      <ReportDivider />

      <ReportSection
        id="report-sales"
        icon="🛒"
        title="Sales"
        summary={
          <p className="text-sm text-slate-600">
            You received {formatCurrency(d.sales.totalSales)} from sales during {d.range.label.toLowerCase()}.
          </p>
        }
      >
        {d.sales.billCount === 0 ? (
          <p className="text-sm text-slate-600">You have no sales in this period.</p>
        ) : (
          <>
            <ReportMetric
              title="Total sales"
              value={formatCurrency(d.sales.totalSales)}
              hint="You received this from sales during the selected period."
            />
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>{d.sales.billCount} bills</p>
              <p>{d.sales.itemsSold} items sold</p>
              <p>Cash sales: {formatCurrency(d.sales.cashSales)}</p>
              <p>UPI sales: {formatCurrency(d.sales.upiSales)}</p>
              <p>Bank sales: {formatCurrency(d.sales.bankSales)}</p>
              <p>Retail: {formatCurrency(d.sales.retailSales)}</p>
              <p>Wholesale: {formatCurrency(d.sales.wholesaleSales)}</p>
            </div>
            <p className="text-sm font-medium text-brand-900">
              You sold {formatCurrency(d.sales.totalSales)} across {d.sales.billCount} bills.
            </p>
            {d.sales.byProduct.map((p) => (
              <SimpleRow
                key={p.productId}
                left={p.name}
                right={formatCurrency(p.salesAmount)}
                sub={`${p.quantitySold} ${p.unit} sold`}
              />
            ))}
          </>
        )}
      </ReportSection>

      <ReportSection
        id="report-purchases"
        icon="🌾"
        title="Purchases"
        summary={
          <p className="text-sm text-slate-600">
            You bought raw materials worth {formatCurrency(d.purchases.totalPaid)}. This is not the same as profit
            or expenses.
          </p>
        }
      >
        {d.purchases.purchaseCount === 0 ? (
          <p className="text-sm text-slate-600">No purchases in this period.</p>
        ) : (
          <>
            <ReportMetric
              title="Money paid"
              value={formatCurrency(d.purchases.totalPaid)}
              hint="What you paid suppliers for materials in this period."
            />
            <p className="text-sm">{d.purchases.purchaseCount} purchase records</p>
            {d.purchases.materials.map((m) => (
              <SimpleRow
                key={m.materialId}
                left={m.name}
                right={formatCurrency(m.totalPaid)}
                sub={`${m.quantity} ${m.unit} · Average ${formatCurrency(m.avgUnitPrice)}/${m.unit}`}
              />
            ))}
            <p className="text-sm text-slate-700">
              You bought {d.purchases.totalQuantityKg > 0 ? `${d.purchases.totalQuantityKg.toFixed(0)} kg of raw material (kg items) ` : 'materials '}
              for {formatCurrency(d.purchases.totalPaid)}.
            </p>
          </>
        )}
      </ReportSection>

      <ReportSection
        id="report-production"
        icon="🏭"
        title="Production"
        summary={
          <p className="text-sm text-slate-600">You produced {fmtL(d.production.totalOilLitres)} of oil in this period.</p>
        }
      >
        {d.production.batchCount === 0 ? (
          <p className="text-sm text-slate-600">No production in this period.</p>
        ) : (
          <>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>{d.production.batchCount} production batches</p>
              <p>{fmtL(d.production.totalOilLitres)} oil produced</p>
              <p>{d.production.totalWasteKg.toFixed(1)} kg waste</p>
              <p>Total cost {formatCurrency(d.production.totalCost)}</p>
            </div>
            {d.production.byProduct.map((p) => (
              <SimpleRow
                key={p.productId}
                left={p.name}
                right={fmtL(p.oilLitres)}
                sub={`${p.wasteKg.toFixed(1)} kg waste · Cost {formatCurrency(p.totalCost)}`}
              />
            ))}
            <p className="text-xs text-slate-500">
              Production cost includes raw materials and ingredients used, plus labour, electricity and overhead when
              recorded, minus waste value credited in the batch.
            </p>
            {d.production.batches.map((b) => (
              <SimpleRow
                key={b.id}
                left={`${b.productName} · ${formatDate(b.date)}`}
                right={formatCurrency(b.totalCost)}
                sub={`Input ${b.inputKg.toFixed(1)} kg · Oil ${fmtL(b.oilLitres)} · Waste ${b.wasteKg.toFixed(1)} kg · ${formatCurrency(b.costPerLitre)}/L · Batch ${b.batchLabel}`}
              />
            ))}
          </>
        )}
      </ReportSection>

      <ReportSection
        id="report-crushing"
        icon="🫒"
        title="Crushing"
        summary={
          <p className="text-sm text-slate-600">
            {d.crushing.customersServed} customers served · {formatCurrency(d.crushing.crushingIncome)} crushing income
          </p>
        }
      >
        {d.crushing.customersServed === 0 ? (
          <p className="text-sm text-slate-600">No crushing jobs in this period.</p>
        ) : (
          <>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <p>{d.crushing.customersServed} customers served</p>
              <p>{d.crushing.kgCrushed.toFixed(1)} kg crushed</p>
              <p>{fmtL(d.crushing.oilReturned)} oil returned to customers</p>
              <p>{d.crushing.cakeReturnedKg.toFixed(1)} kg cake returned</p>
              <p>{d.crushing.cakeBoughtKg.toFixed(1)} kg cake bought from customers</p>
            </div>
            <ReportMetric
              title="Crushing income"
              value={formatCurrency(d.crushing.crushingIncome)}
              hint="Money earned from the crushing service."
            />
            <MoneyLine label="Cake bought from customers" amount={-d.crushing.cakePurchaseValue} />
            <p className="text-xs text-slate-500">Money paid to customers when they sell cake to the mill.</p>
            <MoneyLine label="Net crushing cash" amount={d.crushing.netSettlementCash} bold />
            <p className="text-xs text-slate-500">Crushing income minus cake payments (cash impact from crushing).</p>
            <p className="text-sm text-slate-600">
              Crushing income is money earned for the crushing service. Customer-owned raw material is not counted as your
              stock.
            </p>
          </>
        )}
      </ReportSection>

      <ReportSection
        id="report-expenses"
        icon="💸"
        title="Expenses"
        summary={
          <p className="text-sm text-slate-600">
            You spent {formatCurrency(d.expenses.total)} on running the mill (not purchases).
          </p>
        }
      >
        {d.expenses.count === 0 ? (
          <p className="text-sm text-slate-600">No expenses in this period.</p>
        ) : (
          <>
            <ReportMetric
              title="Total expenses"
              value={formatCurrency(d.expenses.total)}
              hint="Labour, electricity, petrol, maintenance and other business costs."
            />
            <p className="text-sm">{d.expenses.count} expense entries</p>
            <p className="text-sm">
              Cash {formatCurrency(d.expenses.cashTotal)} · UPI {formatCurrency(d.expenses.upiTotal)} · Bank{' '}
              {formatCurrency(d.expenses.bankTotal)}
            </p>
            {d.expenses.byCategory.map((c) => (
              <SimpleRow key={c.name} left={c.name} right={formatCurrency(c.amount)} />
            ))}
            <p className="text-sm font-medium">
              You spent {formatCurrency(d.expenses.total)} on business expenses during this period.
            </p>
          </>
        )}
      </ReportSection>

      <ReportSection
        id="report-stock"
        icon="📦"
        title="Stock"
        summary={<p className="text-sm text-slate-600">What you have right now (not filtered by date).</p>}
      >
        <ReportMetric
          title="What do I have now?"
          value={`${d.stock.totalUnits} units`}
          hint="Rough total across materials, oil, bottles and waste."
        />
        <h3 className="font-bold text-brand-900">Raw materials</h3>
        {d.stock.rawMaterials.length === 0 ? (
          <p className="text-sm text-slate-500">No raw material stock.</p>
        ) : (
          d.stock.rawMaterials.map((r) => (
            <SimpleRow
              key={r.name}
              left={r.name}
              right={`${r.qty.toFixed(1)} ${r.unit}`}
              sub={`${formatCurrency(r.avgCost)}/${r.unit} average cost · ${r.batchCount} batches`}
            />
          ))
        )}
        <h3 className="font-bold text-brand-900">Bulk oil</h3>
        {d.stock.bulkOil.length === 0 ? (
          <p className="text-sm text-slate-500">No bulk oil in stock.</p>
        ) : (
          d.stock.bulkOil.map((b) => (
            <SimpleRow key={b.name} left={b.name} right={fmtL(b.litres)} sub={`${b.batchCount} batches`} />
          ))
        )}
        <h3 className="font-bold text-brand-900">Packaged products</h3>
        {d.stock.packaged.length === 0 ? (
          <p className="text-sm text-slate-500">No packaged stock.</p>
        ) : (
          d.stock.packaged.map((p) => (
            <SimpleRow
              key={`${p.productName}-${p.label}`}
              left={`${p.productName} ${p.label}`}
              right={`${p.qty} bottles`}
            />
          ))
        )}
        <h3 className="font-bold text-brand-900">Waste / cake</h3>
        {d.stock.waste.length === 0 ? (
          <p className="text-sm text-slate-500">No waste stock.</p>
        ) : (
          d.stock.waste.map((w) => (
            <SimpleRow key={w.name} left={w.name} right={`${w.qty.toFixed(1)} ${w.unit}`} />
          ))
        )}
      </ReportSection>

      <ReportSection
        id="report-expiry"
        icon="⏰"
        title="Products that need attention"
        summary={
          <p className="text-sm text-slate-600">
            {d.expiry.needAttention === 0
              ? 'No batches need attention right now.'
              : `${d.expiry.needAttention} batches need attention.`}
          </p>
        }
      >
        <p className="text-sm">Use batches expiring soon first. Do not sell or use expired stock.</p>
        <ExpiryGroup title="Expired" tone="text-red-700" items={d.expiry.items.filter((i) => i.bucket === 'expired')} />
        <ExpiryGroup title="Expiring in 7 days" tone="text-orange-700" items={d.expiry.items.filter((i) => i.bucket === 'd7')} />
        <ExpiryGroup title="Expiring in 15 days" tone="text-amber-700" items={d.expiry.items.filter((i) => i.bucket === 'd15')} />
        <ExpiryGroup title="Expiring in 30 days" tone="text-yellow-700" items={d.expiry.items.filter((i) => i.bucket === 'd30')} />
        <ExpiryGroup title="Safe" tone="text-green-700" items={d.expiry.items.filter((i) => i.bucket === 'safe')} />
      </ReportSection>

      <ReportSection
        id="report-profit"
        icon="💰"
        title="Profit"
        summary={
          <p className="text-sm text-slate-600">
            Your net profit for this period is {formatCurrency(d.profit.netProfit)}.
          </p>
        }
      >
        {d.profit.revenue === 0 && d.expenses.total === 0 ? (
          <p className="text-sm text-slate-600">Not enough data for profit in this period.</p>
        ) : (
          <>
            <ReportMetric
              title="Net profit"
              value={formatCurrency(d.profit.netProfit)}
              hint="What is left after product cost and business expenses."
              accent
            />
            <MoneyLine label="Product sales" amount={d.profit.productSales} />
            <p className="text-xs text-slate-500">Money received from products sold.</p>
            <MoneyLine label="Crushing income" amount={d.profit.crushingIncome} />
            <p className="text-xs text-slate-500">
              Money earned from crushing service. Included because the mill earned money providing crushing.
            </p>
            <MoneyLine label="Total business revenue" amount={d.profit.revenue} bold />
            <MoneyLine label="Minus product cost" amount={-d.profit.productCost} />
            <p className="text-xs text-slate-500">
              COGS for mill-owned products sold. Customer crushing material is not your stock or COGS.
            </p>
            <MoneyLine label="Gross profit" amount={d.profit.grossProfit} bold />
            <MoneyLine label="Minus business expenses" amount={-d.profit.businessExpenses} />
            <p className="text-xs text-slate-500">Labour, electricity, petrol, maintenance and other expenses.</p>
            <MoneyLine label="Net profit" amount={d.profit.netProfit} bold />
            <p className="font-mono text-sm text-slate-700">
              {formatCurrency(d.profit.revenue)} − {formatCurrency(d.profit.productCost)} −{' '}
              {formatCurrency(d.profit.businessExpenses)} = {formatCurrency(d.profit.netProfit)}
            </p>
            <HowCalculated>
              <MoneyLine label="Product sales" amount={d.profit.productSales} />
              <MoneyLine label="Crushing income" amount={d.profit.crushingIncome} />
              <MoneyLine label="Total revenue" amount={d.profit.revenue} />
              <MoneyLine label="Product cost" amount={-d.profit.productCost} />
              <MoneyLine label="Gross profit" amount={d.profit.grossProfit} />
              <MoneyLine label="Business expenses" amount={-d.profit.businessExpenses} />
              <MoneyLine label="Net profit" amount={d.profit.netProfit} bold />
              <p className="pt-2 text-xs">
                Product cost comes from each sale&apos;s stored cost (oil batch cost + packaging). Cake bought from
                customers is inventory—not an operating expense here. Purchases are not subtracted here—they change stock
                and future costs.
              </p>
            </HowCalculated>
          </>
        )}
      </ReportSection>

      <ReportSection
        id="report-money"
        icon="🏦"
        title="Where is my money?"
        summary={
          <p className="text-sm text-slate-600">
            Money available and profit are different. Cash flow shows what you have; profit shows what you earned.
          </p>
        }
      >
        <ReportMetric
          title="Total money available"
          value={formatCurrency(d.money.total)}
          hint="Cash + UPI + Bank right now."
          accent
        />
        <MoneyLine label="Cash" amount={d.money.cash} />
        <MoneyLine label="UPI" amount={d.money.upi} />
        <MoneyLine label="Bank" amount={d.money.bank} />
        {d.money.flows.map((f) => (
          <div key={f.accountType} className="rounded-xl bg-brand-100/30 p-3 text-sm space-y-1">
            <p className="font-bold text-brand-900">{f.title}</p>
            <MoneyLine label="Starting balance (start of period)" amount={f.openingInPeriod} />
            <MoneyLine label="+ Sales received" amount={f.salesIn} />
            <MoneyLine label="+ Crushing charges" amount={f.crushingIn} />
            <MoneyLine label="− Purchases paid" amount={-f.purchasesOut} />
            <MoneyLine label="− Expenses paid" amount={-f.expensesOut} />
            <MoneyLine label="− Cake bought from customers" amount={-f.crushingCakeOut} />
            {(f.otherIn > 0 || f.otherOut > 0) && (
              <>
                <MoneyLine label="Other money in" amount={f.otherIn} />
                <MoneyLine label="Other money out" amount={-f.otherOut} />
              </>
            )}
            <MoneyLine label={`Current ${f.title}`} amount={f.currentBalance} bold />
          </div>
        ))}
        <HowCalculated>
          <p>Current balance = opening balance + all money in − all money out (full history).</p>
          <p>Period lines above only count transactions between {formatDate(d.range.from)} and {formatDate(d.range.to)}.</p>
        </HowCalculated>
      </ReportSection>
    </>
  )
}

function ExpiryGroup({
  title,
  tone,
  items,
}: {
  title: string
  tone: string
  items: ReportsBundle['expiry']['items']
}) {
  if (items.length === 0) return null
  return (
    <div>
      <p className={`text-sm font-bold ${tone}`}>{title}</p>
      {items.map((i) => (
        <SimpleRow
          key={`${i.batchId}-${i.productLabel}`}
          left={i.productLabel}
          right={`${i.quantity} ${i.unit}`}
          sub={`Batch ${i.batchId} · Expires ${formatDate(i.expiryDate)} · ${i.daysLeft < 0 ? 'Expired' : `${i.daysLeft} days left`}`}
        />
      ))}
    </div>
  )
}
