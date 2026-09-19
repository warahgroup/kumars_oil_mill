import { supabase } from '@/lib/supabase'
import {
  aggregatePackagedStock,
  aggregateRawMaterialTotals,
  aggregateWasteStock,
  buildExpiryAlerts,
  listProductionBatches,
  listPurchaseBatches,
  listStockMovements,
} from '@/services/stockService'
import { listProducts, listRawMaterials, getBusinessSettings } from '@/services/masterDataService'

export async function reportSales(from?: string, to?: string) {
  let q = supabase
    .from('sales')
    .select('id, sale_date, reference_no, subtotal, total_amount, total_cogs, discount')
    .order('sale_date', { ascending: false })
    .limit(500)
  if (from) q = q.gte('sale_date', from)
  if (to) q = q.lte('sale_date', to)
  const { data, error } = await q
  if (error) throw error
  return data ?? []
}

export async function reportPurchases() {
  const { data, error } = await supabase
    .from('purchase_transactions')
    .select('id, transaction_date, total_amount, reference_no, supplier:suppliers(name)')
    .order('transaction_date', { ascending: false })
    .limit(500)
  if (error) throw error
  return data ?? []
}

export async function reportProduction() {
  const { data, error } = await supabase
    .from('production_batches')
    .select(
      'id, production_date, oil_output_litres, waste_output_kg, effective_production_cost, cost_per_litre, product:products(name)',
    )
    .order('production_date', { ascending: false })
    .limit(500)
  if (error) throw error
  return data ?? []
}

export async function reportExpenses() {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, expense_date, amount, description, category:expense_categories(name)')
    .order('expense_date', { ascending: false })
    .limit(500)
  if (error) throw error
  return data ?? []
}

export async function reportStockSnapshot() {
  const [purchaseBatches, productionBatches, movements, materials, products, packages] =
    await Promise.all([
      listPurchaseBatches(),
      listProductionBatches(),
      listStockMovements(),
      listRawMaterials(),
      listProducts(),
      supabase.from('product_packages').select('id, label, product_id'),
    ])
  if (packages.error) throw packages.error

  const rawTotals = aggregateRawMaterialTotals(purchaseBatches)
  const packaged = aggregatePackagedStock(movements, productionBatches)
  const waste = aggregateWasteStock(movements)

  return { rawTotals, purchaseBatches, productionBatches, packaged, waste, materials, products, packages: packages.data ?? [] }
}

export async function reportExpiry() {
  const [purchaseBatches, productionBatches, materials, products, settings] = await Promise.all([
    listPurchaseBatches(),
    listProductionBatches(),
    listRawMaterials(),
    listProducts(),
    getBusinessSettings(),
  ])
  const alertDays = (settings?.expiry_alert_days as number[] | undefined) ?? [30, 15, 7]
  return buildExpiryAlerts(purchaseBatches, productionBatches, materials, products, alertDays)
}

export async function reportProfit(from?: string, to?: string) {
  const { calculateProfitMetrics, fetchExpensesForProfitRange, fetchSalesForProfitRange } =
    await import('@/services/businessMetricsService')
  const { fetchCrushingForProfitRange } = await import('@/services/crushingService')
  const f = from ?? '1970-01-01'
  const t = to ?? '2999-12-31'
  const [sales, expenses, crushing] = await Promise.all([
    fetchSalesForProfitRange(f, t),
    fetchExpensesForProfitRange(f, t),
    fetchCrushingForProfitRange(f, t),
  ])
  const m = calculateProfitMetrics(sales, expenses, crushing)
  return {
    revenue: m.revenue,
    cogs: m.productCost,
    grossProfit: m.grossProfit,
    operatingExpenses: m.businessExpenses,
    netProfit: m.netProfit,
  }
}

export async function reportCashFlow() {
  const { data, error } = await supabase
    .from('financial_transactions')
    .select(
      'id, transaction_date, direction, amount, description, reference_kind, account:financial_accounts(name, account_type)',
    )
    .order('transaction_date', { ascending: false })
    .limit(500)
  if (error) throw error
  return data ?? []
}
