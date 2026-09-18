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
  let salesQ = supabase.from('sales').select('subtotal, total_amount, total_cogs, discount, sale_date')
  let expQ = supabase.from('expenses').select('amount, expense_date')
  if (from) {
    salesQ = salesQ.gte('sale_date', from)
    expQ = expQ.gte('expense_date', from)
  }
  if (to) {
    salesQ = salesQ.lte('sale_date', to)
    expQ = expQ.lte('expense_date', to)
  }
  const [salesRes, expRes] = await Promise.all([salesQ, expQ])
  if (salesRes.error) throw salesRes.error
  if (expRes.error) throw expRes.error

  const revenue = (salesRes.data ?? []).reduce((s, r) => s + Number(r.subtotal), 0)
  const cogs = (salesRes.data ?? []).reduce((s, r) => s + Number(r.total_cogs), 0)
  const operating = (expRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
  const grossProfit = revenue - cogs
  const netProfit = grossProfit - operating
  return { revenue, cogs, grossProfit, operatingExpenses: operating, netProfit }
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
