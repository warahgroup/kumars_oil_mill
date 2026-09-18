import { useState } from 'react'
import { PageShell } from '@/components/common/PageShell'
import { PageState } from '@/components/common/PageState'
import { Card } from '@/components/ui/Card'
import { formatCurrency, formatDate } from '@/lib/format'
import { useQuery } from '@/hooks/useQuery'
import {
  aggregatePackagedStock,
  aggregateRawMaterialTotals,
  aggregateWasteStock,
  listProductionBatches,
  listPurchaseBatches,
  listStockMovements,
} from '@/services/stockService'
import { listProductPackages, listProducts, listRawMaterials } from '@/services/masterDataService'

type BatchDetail =
  | { kind: 'purchase'; batch: Awaited<ReturnType<typeof listPurchaseBatches>>[number] }
  | { kind: 'production'; batch: Awaited<ReturnType<typeof listProductionBatches>>[number] }

export default function StockPage() {
  const { state, reload } = useQuery(async () => {
    const [materials, products, packages, purchaseBatches, productionBatches, movements] =
      await Promise.all([
        listRawMaterials(),
        listProducts(),
        listProductPackages(),
        listPurchaseBatches(),
        listProductionBatches(),
        listStockMovements(),
      ])
    const rawTotals = aggregateRawMaterialTotals(purchaseBatches)
    const packaged = aggregatePackagedStock(movements, productionBatches)
    const waste = aggregateWasteStock(movements)
    return { materials, products, packages, purchaseBatches, productionBatches, rawTotals, packaged, waste }
  }, [])

  const [detail, setDetail] = useState<BatchDetail | null>(null)

  return (
    <PageShell title="Stock" subtitle="What you have in the mill">
      {state.status === 'loading' ? <PageState status="loading" label="Loading stock…" /> : null}
      {state.status === 'error' ? <PageState status="error" message={state.message} onRetry={reload} /> : null}
      {state.status === 'success' ? (
        <StockContent state={state.data} detail={detail} setDetail={setDetail} />
      ) : null}
    </PageShell>
  )
}

function StockContent({
  state,
  detail,
  setDetail,
}: {
  state: {
    materials: Awaited<ReturnType<typeof listRawMaterials>>
    products: Awaited<ReturnType<typeof listProducts>>
    packages: Awaited<ReturnType<typeof listProductPackages>>
    purchaseBatches: Awaited<ReturnType<typeof listPurchaseBatches>>
    productionBatches: Awaited<ReturnType<typeof listProductionBatches>>
    rawTotals: ReturnType<typeof aggregateRawMaterialTotals>
    packaged: ReturnType<typeof aggregatePackagedStock>
    waste: ReturnType<typeof aggregateWasteStock>
  }
  detail: BatchDetail | null
  setDetail: (d: BatchDetail | null) => void
}) {
  const { materials, products, packages, purchaseBatches, productionBatches, rawTotals, packaged, waste } =
    state

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-700">Raw materials</h2>
        <div className="grid gap-2">
          {materials.map((m) => (
            <Card key={m.id} className="flex justify-between text-sm">
              <span className="font-medium">{m.name}</span>
              <span>{rawTotals.get(m.id)?.toFixed(2) ?? '0'} {m.unit}</span>
            </Card>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          {purchaseBatches.filter((b) => Number(b.remaining_quantity) > 0).map((b) => (
            <button key={b.id} type="button" className="w-full text-left" onClick={() => setDetail({ kind: 'purchase', batch: b })}>
              <Card className="text-sm">
                <div className="flex justify-between">
                  <span>{materials.find((m) => m.id === b.raw_material_id)?.name} — {b.batch_code}</span>
                  <span>{Number(b.remaining_quantity).toFixed(2)} left</span>
                </div>
                <p className="text-slate-500">Expiry: {formatDate(b.expiry_date)}</p>
              </Card>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-700">Bulk oil</h2>
        {productionBatches.filter((b) => Number(b.remaining_bulk_litres) > 0).map((b) => (
          <button key={b.id} type="button" className="mb-2 w-full text-left" onClick={() => setDetail({ kind: 'production', batch: b })}>
            <Card className="text-sm">
              <div className="flex justify-between">
                <span>{products.find((p) => p.id === b.output_product_id)?.name}</span>
                <span>{Number(b.remaining_bulk_litres).toFixed(2)} L</span>
              </div>
              <p className="text-slate-500">Expiry: {formatDate(b.expiry_date)} · {formatCurrency(Number(b.cost_per_litre))}/L</p>
            </Card>
          </button>
        ))}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-700">Packaged products</h2>
        {packaged.map((row) => {
          const pkg = packages.find((p) => p.id === row.product_package_id)
          const prod = products.find((p) => p.id === pkg?.product_id)
          return (
            <Card key={`${row.product_package_id}-${row.production_batch_id}`} className="mb-2 text-sm">
              <div className="flex justify-between">
                <span>{prod?.name} {pkg?.label}</span>
                <span>{row.quantity} pcs</span>
              </div>
              <p className="text-slate-500">Expiry: {formatDate(row.expiry_date)}</p>
            </Card>
          )
        })}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-brand-700">Waste</h2>
        {products.filter((p) => p.is_waste).map((p) => (
          <Card key={p.id} className="mb-2 flex justify-between text-sm">
            <span>{p.name}</span>
            <span>{(waste.get(p.id) ?? 0).toFixed(2)} {p.unit}</span>
          </Card>
        ))}
      </section>

      {detail ? (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-4 md:items-center">
          <Card className="w-full max-w-md space-y-2 text-sm" padding="lg">
            <h3 className="text-lg font-bold text-brand-900">Batch details</h3>
            {detail.kind === 'purchase' ? (
              <>
                <p><strong>Batch ID:</strong> {detail.batch.batch_code}</p>
                <p><strong>Purchase date:</strong> {formatDate(detail.batch.purchase_date)}</p>
                <p><strong>Expiry:</strong> {formatDate(detail.batch.expiry_date)}</p>
                <p><strong>Original:</strong> {detail.batch.original_quantity}</p>
                <p><strong>Remaining:</strong> {detail.batch.remaining_quantity}</p>
                <p><strong>Unit cost:</strong> {formatCurrency(detail.batch.unit_cost)}</p>
              </>
            ) : (
              <>
                <p><strong>Batch ID:</strong> {detail.batch.id}</p>
                <p><strong>Production date:</strong> {formatDate(detail.batch.production_date)}</p>
                <p><strong>Expiry:</strong> {formatDate(detail.batch.expiry_date)}</p>
                <p><strong>Original oil:</strong> {detail.batch.oil_output_litres} L</p>
                <p><strong>Remaining bulk:</strong> {detail.batch.remaining_bulk_litres} L</p>
                <p><strong>Cost/L:</strong> {formatCurrency(detail.batch.cost_per_litre)}</p>
              </>
            )}
            <button type="button" className="min-h-12 font-semibold text-brand-700" onClick={() => setDetail(null)}>Close</button>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
