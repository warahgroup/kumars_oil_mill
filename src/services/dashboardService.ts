import { localIsoDate } from '@/lib/dateRangeFilter'
import { supabase } from '@/lib/supabase'
import {
  calculateProfitMetrics,
  fetchExpensesForProfitRange,
  fetchSalesForProfitRange,
  getMoneyAvailable,
} from '@/services/businessMetricsService'
import { fetchCrushingForProfitRange, listCrushing } from '@/services/crushingService'
import { cachedQuery } from '@/lib/dataCache'
import {
  aggregateRawMaterialTotals,
  buildExpiryAlerts,
  buildLowStock,
  listProductionBatches,
  listPurchaseBatches,
} from '@/services/stockService'
import { listProducts, listRawMaterials, getBusinessSettings } from '@/services/masterDataService'

export type DashboardData = {
  todaySales: number
  todayExpenses: number
  todayGrossProfit: number
  todayNetProfit: number
  todayProductionLitres: number
  todayCrushing: {
    customers: number
    kgCrushed: number
    oilReturned: number
    crushingIncome: number
  }
  balances: { cash: number; upi: number; bank: number }
  lowStock: ReturnType<typeof buildLowStock>
  expiryAlerts: ReturnType<typeof buildExpiryAlerts>
  materialNames: Map<string, string>
}

export async function loadDashboard(): Promise<DashboardData> {
  const day = localIsoDate()

  return cachedQuery(`dashboard:${day}`, async () => {
    const crushingSafe = async () => {
      try {
        return await fetchCrushingForProfitRange(day, day)
      } catch {
        return []
      }
    }
    const crushingTodaySafe = async () => {
      try {
        return await listCrushing(day, day)
      } catch {
        return []
      }
    }

    const [
      salesForProfit,
      expensesForProfit,
      crushingForProfit,
      crushingToday,
      productionRes,
      money,
      purchaseBatches,
      productionBatches,
      materials,
      products,
      settings,
    ] = await Promise.all([
      fetchSalesForProfitRange(day, day),
      fetchExpensesForProfitRange(day, day),
      crushingSafe(),
      crushingTodaySafe(),
      supabase
        .from('production_batches')
        .select('oil_output_litres')
        .eq('production_date', day),
      getMoneyAvailable(),
      listPurchaseBatches({ withRemainingOnly: true }),
      listProductionBatches({ withRemainingOnly: true }),
      listRawMaterials(),
      listProducts(),
      getBusinessSettings(),
    ])

    if (productionRes.error) throw productionRes.error

    const profit = calculateProfitMetrics(salesForProfit, expensesForProfit, crushingForProfit)
    const todaySales = profit.revenue
    const todayExpenses = profit.businessExpenses
    const todayGrossProfit = profit.grossProfit
    const todayNetProfit = profit.netProfit
    const todayProductionLitres = (productionRes.data ?? []).reduce(
      (s, r) => s + Number(r.oil_output_litres),
      0,
    )
    const balances = { cash: money.cash, upi: money.upi, bank: money.bank }

    const uniqueCustomers = new Set(crushingToday.map((c) => c.customer_id ?? c.id))
    const todayCrushing = {
      customers: uniqueCustomers.size,
      kgCrushed: crushingToday.reduce((s, r) => s + Number(r.input_quantity), 0),
      oilReturned: crushingToday.reduce((s, r) => s + Number(r.oil_output_quantity), 0),
      crushingIncome: crushingForProfit.reduce((s, r) => s + Number(r.crushing_charge), 0),
    }

    const rawTotals = aggregateRawMaterialTotals(purchaseBatches)
    const alertDays = (settings?.expiry_alert_days as number[] | undefined) ?? [30, 15, 7]

    return {
      todaySales,
      todayExpenses,
      todayGrossProfit,
      todayNetProfit,
      todayProductionLitres,
      todayCrushing,
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
