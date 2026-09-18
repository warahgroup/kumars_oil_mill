import { useParams } from 'react-router-dom'
import { PageShell } from '@/components/common/PageShell'
import { PageState } from '@/components/common/PageState'
import { Card } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/format'
import { useQuery } from '@/hooks/useQuery'
import { getSaleDetail } from '@/services/salesService'

export default function BillDetailPage() {
  const { saleId } = useParams<{ saleId: string }>()
  const { state, reload } = useQuery(async () => {
    if (!saleId) throw new Error('Bill not found')
    return getSaleDetail(saleId)
  }, [saleId])

  if (state.status === 'loading') return <PageState status="loading" />
  if (state.status === 'error') return <PageState status="error" message={state.message} onRetry={reload} />

  const { sale, items } = state.data
  const customer = sale.customer as { name?: string; phone?: string; address?: string } | null
  const account = sale.account as { name?: string; account_type?: string } | null

  return (
    <PageShell title="Bill" subtitle={sale.reference_no ?? sale.id} backTo="/bills" width="narrow">
      <Card className="mb-4 space-y-1 text-sm">
        <p><strong>Bill number:</strong> {sale.reference_no ?? '—'}</p>
        <p><strong>Date:</strong> {formatDate(sale.sale_date)}</p>
        <p><strong>Customer:</strong> {customer?.name ?? 'Walk-in'}</p>
        <p><strong>Payment:</strong> {account?.name ?? '—'}</p>
      </Card>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="py-2">Item</th>
              <th>Qty</th>
              <th>Package</th>
              <th>Price</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const product = item.product as { name?: string; unit?: string } | null
              const packageInfo = item.package as { label?: string } | null
              return (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="py-2">{product?.name ?? 'Item'}</td>
                  <td>{item.quantity}</td>
                  <td>{item.is_bulk_sale ? 'Bulk' : packageInfo?.label ?? '—'}</td>
                  <td>{formatCurrency(Number(item.unit_price))}</td>
                  <td>{formatCurrency(Number(item.line_total))}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="mt-4 space-y-1 text-sm">
          <p className="flex justify-between"><span>Subtotal</span><span>{formatCurrency(Number(sale.subtotal))}</span></p>
          <p className="flex justify-between"><span>Discount</span><span>{formatCurrency(Number(sale.discount))}</span></p>
          <p className="flex justify-between font-semibold text-base"><span>Grand total</span><span>{formatCurrency(Number(sale.total_amount))}</span></p>
        </div>
      </Card>
    </PageShell>
  )
}
