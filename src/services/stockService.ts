import { cachedQuery } from '@/lib/dataCache'
import { supabase } from '@/lib/supabase'
import type { ProductionBatch, PurchaseBatch, StockMovement } from '@/types/entities'

const LOW_STOCK_THRESHOLD = 10

type BatchQueryOptions = { withRemainingOnly?: boolean }

export async function listPurchaseBatches(options?: BatchQueryOptions): Promise<PurchaseBatch[]> {
  const withRemainingOnly = options?.withRemainingOnly ?? false
  return cachedQuery(`stock:purchase:${withRemainingOnly}`, async () => {
    let q = supabase
      .from('purchase_batches')
      .select(
        'id, batch_code, raw_material_id, original_quantity, remaining_quantity, purchase_date, expiry_date, unit_cost',
      )
      .order('expiry_date')
    if (withRemainingOnly) {
      q = q.gt('remaining_quantity', 0)
    }
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as PurchaseBatch[]
  }, 45_000)
}

export async function listProductionBatches(options?: BatchQueryOptions): Promise<ProductionBatch[]> {
  const withRemainingOnly = options?.withRemainingOnly ?? false
  return cachedQuery(`stock:production:${withRemainingOnly}`, async () => {
    let q = supabase
      .from('production_batches')
      .select(
        'id, output_product_id, production_date, expiry_date, oil_output_litres, waste_output_kg, remaining_bulk_litres, cost_per_litre, effective_production_cost',
      )
      .order('expiry_date')
    if (withRemainingOnly) {
      q = q.gt('remaining_bulk_litres', 0)
    }
    const { data, error } = await q
    if (error) throw error
    return (data ?? []) as ProductionBatch[]
  }, 45_000)
}

export async function listStockMovements(limit = 2500): Promise<StockMovement[]> {
  return cachedQuery(`stock:movements:${limit}`, async () => {
    const { data, error } = await supabase
      .from('stock_movements')
      .select(
        'id, movement_date, direction, item_type, product_id, raw_material_id, product_package_id, purchase_batch_id, production_batch_id, quantity, unit_cost',
      )
      .order('movement_date', { ascending: false })
      .limit(limit)
    if (error) throw error
    return (data ?? []) as StockMovement[]
  }, 30_000)
}

export type PackagedStockRow = {
  product_package_id: string
  production_batch_id: string
  quantity: number
  expiry_date: string
}

export function aggregatePackagedStock(
  movements: StockMovement[],
  productionBatches: ProductionBatch[],
): PackagedStockRow[] {
  const expiryMap = new Map(productionBatches.map((b) => [b.id, b.expiry_date]))
  const totals = new Map<string, number>()

  for (const m of movements) {
    if (m.item_type !== 'packaged' || !m.product_package_id || !m.production_batch_id) continue
    const key = `${m.product_package_id}:${m.production_batch_id}`
    const delta = m.direction === 'in' ? Number(m.quantity) : -Number(m.quantity)
    totals.set(key, (totals.get(key) ?? 0) + delta)
  }

  const rows: PackagedStockRow[] = []
  for (const [key, qty] of totals) {
    if (qty <= 0) continue
    const [product_package_id, production_batch_id] = key.split(':')
    rows.push({
      product_package_id,
      production_batch_id,
      quantity: qty,
      expiry_date: expiryMap.get(production_batch_id) ?? '',
    })
  }
  return rows.sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))
}

export function aggregateWasteStock(movements: StockMovement[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const m of movements) {
    if (m.item_type !== 'waste' || !m.product_id) continue
    const delta = m.direction === 'in' ? Number(m.quantity) : -Number(m.quantity)
    totals.set(m.product_id, (totals.get(m.product_id) ?? 0) + delta)
  }
  return totals
}

export function aggregateRawMaterialTotals(batches: PurchaseBatch[]): Map<string, number> {
  const totals = new Map<string, number>()
  for (const b of batches) {
    totals.set(
      b.raw_material_id,
      (totals.get(b.raw_material_id) ?? 0) + Number(b.remaining_quantity),
    )
  }
  return totals
}

export type LowStockItem = { raw_material_id: string; quantity: number; unit: string }

export type ExpiryAlert = {
  kind: 'purchase' | 'production'
  id: string
  label: string
  expiry_date: string
  remaining: number
  unit: string
  daysLeft: number
}

export function buildLowStock(
  rawTotals: Map<string, number>,
  materials: { id: string; name: string; unit: string }[],
): LowStockItem[] {
  const items: LowStockItem[] = []
  for (const m of materials) {
    const qty = rawTotals.get(m.id) ?? 0
    if (qty < LOW_STOCK_THRESHOLD) {
      items.push({ raw_material_id: m.id, quantity: qty, unit: m.unit })
    }
  }
  return items.sort((a, b) => a.quantity - b.quantity)
}

export function buildExpiryAlerts(
  purchaseBatches: PurchaseBatch[],
  productionBatches: ProductionBatch[],
  materials: { id: string; name: string; unit: string }[],
  products: { id: string; name: string; unit: string }[],
  alertDays: number[],
): ExpiryAlert[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const maxDay = Math.max(...alertDays, 30)
  const alerts: ExpiryAlert[] = []

  const materialName = new Map(materials.map((m) => [m.id, m.name]))
  const productName = new Map(products.map((p) => [p.id, p.name]))
  const materialUnit = new Map(materials.map((m) => [m.id, m.unit]))

  for (const b of purchaseBatches) {
    if (Number(b.remaining_quantity) <= 0) continue
    const exp = new Date(b.expiry_date)
    const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86400000)
    if (daysLeft <= maxDay) {
      alerts.push({
        kind: 'purchase',
        id: b.id,
        label: `${materialName.get(b.raw_material_id) ?? 'Material'} (${b.batch_code})`,
        expiry_date: b.expiry_date,
        remaining: Number(b.remaining_quantity),
        unit: materialUnit.get(b.raw_material_id) ?? 'kg',
        daysLeft,
      })
    }
  }

  for (const b of productionBatches) {
    if (Number(b.remaining_bulk_litres) <= 0) continue
    const exp = new Date(b.expiry_date)
    const daysLeft = Math.ceil((exp.getTime() - today.getTime()) / 86400000)
    if (daysLeft <= maxDay) {
      alerts.push({
        kind: 'production',
        id: b.id,
        label: `${productName.get(b.output_product_id) ?? 'Oil'} batch`,
        expiry_date: b.expiry_date,
        remaining: Number(b.remaining_bulk_litres),
        unit: 'L',
        daysLeft,
      })
    }
  }

  return alerts.sort((a, b) => a.daysLeft - b.daysLeft)
}

export async function simulateFefoRawCost(
  rawMaterialId: string,
  quantityNeeded: number,
): Promise<number> {
  const { data, error } = await supabase
    .from('purchase_batches')
    .select('remaining_quantity, unit_cost, expiry_date, purchase_date')
    .eq('raw_material_id', rawMaterialId)
    .gt('remaining_quantity', 0)
    .gte('expiry_date', new Date().toISOString().slice(0, 10))
    .order('expiry_date')
    .order('purchase_date')
  if (error) throw error

  let need = quantityNeeded
  let cost = 0
  for (const row of data ?? []) {
    const take = Math.min(need, Number(row.remaining_quantity))
    cost += take * Number(row.unit_cost)
    need -= take
    if (need <= 0.0001) break
  }
  if (need > 0.0001) throw new Error('Insufficient non-expired raw stock for estimate')
  return cost
}

export async function getMonthlyWeightedAverage(
  rawMaterialId: string,
  year: number,
  month: number,
): Promise<number | null> {
  const { data, error } = await supabase
    .from('monthly_cost_summaries')
    .select('weighted_avg_cost')
    .eq('raw_material_id', rawMaterialId)
    .eq('year', year)
    .eq('month', month)
    .maybeSingle()
  if (error) throw error
  return data ? Number(data.weighted_avg_cost) : null
}
