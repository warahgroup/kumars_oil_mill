import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Card } from '@/components/ui/Card'
import { PageShell } from '@/components/common/PageShell'
import { PageState } from '@/components/common/PageState'
import { formatCurrency, formatDate } from '@/lib/format'
import { crushingCustomerDisplayName, getCrushing, type CrushingRow } from '@/services/crushingService'

export default function CrushingDetailPage() {
  const { id } = useParams()
  const [row, setRow] = useState<CrushingRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    void getCrushing(id)
      .then((r) => {
        if (!r) setError('Not found')
        else setRow(r)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [id])

  if (error) {
    return (
      <PageShell title="Crushing" backTo="/crushing">
        <PageState status="error" message={error} />
      </PageShell>
    )
  }

  if (!row) {
    return (
      <PageShell title="Crushing" backTo="/crushing">
        <PageState status="loading" label="Loading…" />
      </PageShell>
    )
  }

  const finalPay =
    row.settlement_direction === 'customer_pays_mill'
      ? `Customer pays ${formatCurrency(row.net_settlement_amount)}`
      : row.settlement_direction === 'mill_pays_customer'
        ? `Mill pays customer ${formatCurrency(row.net_settlement_amount)}`
        : 'Settled (₹0)'

  return (
    <PageShell title="Crushing job" subtitle={row.transaction_code} backTo="/crushing">
      <div className="mx-auto max-w-lg space-y-4">
        <Card className="space-y-2 text-sm">
          {crushingCustomerDisplayName(row.customer?.name) ? (
            <p><strong>Shop:</strong> {crushingCustomerDisplayName(row.customer?.name)}</p>
          ) : null}
          <p><strong>Date:</strong> {formatDate(row.crushing_date)}</p>
          <p><strong>Material:</strong> {row.raw_material?.name}</p>
          <p><strong>Input:</strong> {row.input_quantity} kg</p>
          <p><strong>Oil returned:</strong> {row.oil_output_quantity} L</p>
          <p><strong>Cake:</strong> {row.cake_output_quantity} kg</p>
          <p>
            <strong>Cake handling:</strong>{' '}
            {row.cake_handling === 'customer_takes' ? 'Customer took cake' : 'Sold to mill'}
          </p>
          <p><strong>Crushing charge:</strong> {formatCurrency(row.crushing_charge)}</p>
          {row.cake_purchase_value > 0 ? (
            <p><strong>Cake value:</strong> {formatCurrency(row.cake_purchase_value)}</p>
          ) : null}
          <p><strong>Payment:</strong> {row.account?.name ?? '—'}</p>
          {row.notes ? <p><strong>Notes:</strong> {row.notes}</p> : null}
        </Card>

        <Card className="border-2 border-accent-400 bg-accent-50/40 p-4">
          <p className="text-xs font-bold uppercase text-slate-500">Final settlement</p>
          <p className="mt-2 text-xl font-bold text-brand-900">{finalPay}</p>
        </Card>
      </div>
    </PageShell>
  )
}
