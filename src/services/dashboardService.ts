import { supabase } from '@/lib/supabase'
import { getAllAccountBalances } from '@/services/financialService'
import { cachedQuery } from '@/lib/dataCache'
import {
  aggregateRawMaterialTotals,
  buildExpiryAlerts,
  buildLowStock,
  listProductionBatches,
  listPurchaseBatches,
} from '@/services/stockService'
import { listProducts, listRawMaterials, getBusinessSettings } from '@/services/masterDataService'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

export type DashboardData = {
  todaySales: number
  todayExpenses: number
  todayGrossProfit: number
  todayNetProfit: number
  todayProductionLitres: number
  balances: { cash: number; upi: number; bank: number }
  lowStock: ReturnType<typeof buildLowStock>
  expiryAlerts: ReturnType<typeof buildExpiryAlerts>
  materialNames: Map<string, string>
}

export async function loadDashboard(): Promise<DashboardData> {
  const day = todayIso()

  return cachedQuery(`dashboard:${day}`, async () => {
    const [
      salesRes,
      expensesRes,
      productionRes,
      balances,
      purchaseBatches,
      productionBatches,
      materials,
      products,
      settings,
    ] = await Promise.all([
      supabase.from('sales').select('subtotal, total_amount, total_cogs').eq('sale_date', day),
      supabase.from('expenses').select('amount').eq('expense_date', day),
      supabase
        .from('production_batches')
        .select('oil_output_litres')
        .eq('production_date', day),
      getAllAccountBalances(),
      listPurchaseBatches({ withRemainingOnly: true }),
      listProductionBatches({ withRemainingOnly: true }),
      listRawMaterials(),
      listProducts(),
      getBusinessSettings(),
    ])

    if (salesRes.error) throw salesRes.error
    if (expensesRes.error) throw expensesRes.error
    if (productionRes.error) throw productionRes.error

    const todaySales = (salesRes.data ?? []).reduce((s, r) => s + Number(r.total_amount), 0)
    const todaySubtotal = (salesRes.data ?? []).reduce((s, r) => s + Number(r.subtotal), 0)
    const todayCogs = (salesRes.data ?? []).reduce((s, r) => s + Number(r.total_cogs), 0)
    const todayExpenses = (expensesRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
    const todayGrossProfit = todaySubtotal - todayCogs
    const todayNetProfit = todayGrossProfit - todayExpenses
    const todayProductionLitres = (productionRes.data ?? []).reduce(
      (s, r) => s + Number(r.oil_output_litres),
      0,
    )

    const rawTotals = aggregateRawMaterialTotals(purchaseBatches)
    const alertDays = (settings?.expiry_alert_days as number[] | undefined) ?? [30, 15, 7]

    return {
      todaySales,
      todayExpenses,
      todayGrossProfit,
      todayNetProfit,
      todayProductionLitres,
      balances,
      lowStock: buildLowStock(rawTotals, materials),
      expiryAlerts: buildExpiryAlerts(
        purchaseBatches,
        productionBatches,
        materials,
        products,
        alertDays,
      ),
      materialNames: new Map(materials.map((m) => [m.id, m.name])),
    }
  }, 45_000)
}
