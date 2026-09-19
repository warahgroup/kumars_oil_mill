import type { ReportDateRange } from '@/lib/reportDateRange'
import { supabase } from '@/lib/supabase'
import {
  calculateProfitMetrics,
  computeAccountFlows,
  fetchAllFinancialTransactions,
  fetchExpensesForProfitRange,
  fetchSalesForProfitRange,
  getMoneyAvailable,
  type ProfitMetrics,
  type AccountMoneyFlow,
} from '@/services/businessMetricsService'
import { listFinancialAccounts } from '@/services/financialService'
import {
  aggregatePackagedStock,
  aggregateRawMaterialTotals,
  aggregateWasteStock,
  listProductionBatches,
  listPurchaseBatches,
  listStockMovements,
} from '@/services/stockService'
import { listProducts, listRawMaterials } from '@/services/masterDataService'
import { fetchCrushingForProfitRange, listCrushing } from '@/services/crushingService'

async function paginate<T>(loadPage: (from: number, to: number) => Promise<T[]>): Promise<T[]> {
  const pageSize = 1000
  let offset = 0
  const all: T[] = []
  for (;;) {
    const rows = await loadPage(offset, offset + pageSize - 1)
    all.push(...rows)
    if (rows.length < pageSize) break
    offset += pageSize
  }
  return all
}

function normalizeOne<T>(value: T | T[] | null): T | null {
  if (!value) return null
  return Array.isArray(value) ? value[0] ?? null : value
}

export type ProductSalesLine = {
  productId: string
  name: string
  unit: string
  quantitySold: number
  salesAmount: number
}

export type SalesReportData = {
  totalSales: number
  billCount: number
  itemsSold: number
  cashSales: number
  upiSales: number
  bankSales: number
  retailSales: number
  wholesaleSales: number
  byProduct: ProductSalesLine[]
}

export type PurchaseMaterialLine = {
  materialId: string
  name: string
  quantity: number
  unit: string
  totalPaid: number
  avgUnitPrice: number
}

export type PurchasesReportData = {
  totalPaid: number
  purchaseCount: number
  totalQuantityKg: number
  materials: PurchaseMaterialLine[]
}

export type ProductionBatchLine = {
  id: string
  batchLabel: string
  date: string
  productName: string
  inputKg: number
  oilLitres: number
  wasteKg: number
  totalCost: number
  costPerLitre: number
}

export type ProductionByProduct = {
  productId: string
  name: string
  oilLitres: number
  wasteKg: number
  totalCost: number
}

export type ProductionReportData = {
  batchCount: number
  totalOilLitres: number
  totalWasteKg: number
  totalCost: number
  byProduct: ProductionByProduct[]
  batches: ProductionBatchLine[]
}

export type ExpensesReportData = {
  total: number
  count: number
  cashTotal: number
  upiTotal: number
  bankTotal: number
  byCategory: { name: string; amount: number }[]
}

export type StockReportData = {
  rawMaterials: { name: string; qty: number; unit: string; avgCost: number; batchCount: number }[]
  bulkOil: { name: string; litres: number; batchCount: number }[]
  packaged: { label: string; productName: string; qty: number }[]
  waste: { name: string; qty: number; unit: string }[]
  totalUnits: number
}

export type ExpiryBucket = 'expired' | 'd7' | 'd15' | 'd30' | 'safe'

export type ExpiryItem = {
  bucket: ExpiryBucket
  productLabel: string
  batchId: string
  quantity: number
  unit: string
  expiryDate: string
  daysLeft: number
}

export type ExpiryReportData = {
  needAttention: number
  expired: number
  under7: number
  under30: number
  items: ExpiryItem[]
}

export type CrushingReportData = {
  customersServed: number
  kgCrushed: number
  oilReturned: number
  cakeReturnedKg: number
  cakeBoughtKg: number
  crushingIncome: number
  cakePurchaseValue: number
  netSettlementCash: number
}

export type ReportsBundle = {
  range: ReportDateRange
  sales: SalesReportData
  purchases: PurchasesReportData
  production: ProductionReportData
  expenses: ExpensesReportData
  crushing: CrushingReportData
  stock: StockReportData
  expiry: ExpiryReportData
  profit: ProfitMetrics
  money: {
    cash: number
    upi: number
    bank: number
    total: number
    flows: AccountMoneyFlow[]
  }
}

function paymentSplit(
  sales: { total_amount: number; account?: { account_type?: string } | null }[],
) {
  let cash = 0
  let upi = 0
  let bank = 0
  for (const s of sales) {
    const amt = Number(s.total_amount)
    const t = s.account?.account_type
    if (t === 'cash') cash += amt
    else if (t === 'upi') upi += amt
    else if (t === 'bank') bank += amt
    else cash += amt
  }
  return { cash, upi, bank }
}

export async function loadReportsBundle(range: ReportDateRange): Promise<ReportsBundle> {
  const { from, to } = range

  const salesRows = await paginate(async (pageFrom, pageTo) => {
    const { data, error } = await supabase
      .from('sales')
      .select('id, total_amount, account:financial_accounts(account_type)')
      .gte('sale_date', from)
      .lte('sale_date', to)
      .order('sale_date', { ascending: false })
      .range(pageFrom, pageTo)
    if (error) throw error
    return (data ?? []).map((row) => ({
      id: row.id as string,
      total_amount: Number(row.total_amount),
      account: normalizeOne(row.account as { account_type: string } | { account_type: string }[] | null),
    }))
  })

  const saleIds = salesRows.map((s) => s.id)
  let saleItems: {
    product_id: string
    quantity: number
    line_total: number
    is_bulk_sale: boolean
    product: { name: string; unit: string } | null
  }[] = []

  if (saleIds.length > 0) {
    const chunk = 200
    for (let i = 0; i < saleIds.length; i += chunk) {
      const ids = saleIds.slice(i, i + chunk)
      const { data, error } = await supabase
        .from('sale_items')
        .select('product_id, quantity, line_total, is_bulk_sale, product:products(name, unit)')
        .in('sale_id', ids)
      if (error) throw error
      for (const row of data ?? []) {
        const product = normalizeOne(row.product as { name: string; unit: string } | { name: string; unit: string }[] | null)
        saleItems.push({
          product_id: row.product_id as string,
          quantity: Number(row.quantity),
          line_total: Number(row.line_total),
          is_bulk_sale: Boolean(row.is_bulk_sale),
          product,
        })
      }
    }
  }

  const productMap = new Map<string, ProductSalesLine>()
  let itemsSold = 0
  let retailSales = 0
  let wholesaleSales = 0
  for (const item of saleItems) {
    itemsSold += Number(item.quantity)
    const lt = Number(item.line_total)
    if (item.is_bulk_sale) wholesaleSales += lt
    else retailSales += lt
    const pid = item.product_id
    const cur = productMap.get(pid) ?? {
      productId: pid,
      name: item.product?.name ?? 'Product',
      unit: item.product?.unit ?? '',
      quantitySold: 0,
      salesAmount: 0,
    }
    cur.quantitySold += Number(item.quantity)
    cur.salesAmount += lt
    productMap.set(pid, cur)
  }

  const pay = paymentSplit(salesRows)
  const salesReport: SalesReportData = {
    totalSales: salesRows.reduce((s, r) => s + Number(r.total_amount), 0),
    billCount: salesRows.length,
    itemsSold,
    cashSales: pay.cash,
    upiSales: pay.upi,
    bankSales: pay.bank,
    retailSales,
    wholesaleSales,
    byProduct: [...productMap.values()].sort((a, b) => b.salesAmount - a.salesAmount),
  }

  const purchaseTxs = await paginate(async (pageFrom, pageTo) => {
    const { data, error } = await supabase
      .from('purchase_transactions')
      .select('id, total_amount')
      .gte('transaction_date', from)
      .lte('transaction_date', to)
      .range(pageFrom, pageTo)
    if (error) throw error
    return (data ?? []) as { id: string; total_amount: number }[]
  })

  const purchaseTxIds = purchaseTxs.map((p) => p.id)
  let batches: {
    raw_material_id: string
    original_quantity: number
    unit_cost: number
    purchase_transaction_id: string
  }[] = []

  if (purchaseTxIds.length > 0) {
    const chunk = 200
    for (let i = 0; i < purchaseTxIds.length; i += chunk) {
      const ids = purchaseTxIds.slice(i, i + chunk)
      const { data, error } = await supabase
        .from('purchase_batches')
        .select('raw_material_id, original_quantity, unit_cost, purchase_transaction_id')
        .in('purchase_transaction_id', ids)
      if (error) throw error
      batches = batches.concat((data ?? []) as typeof batches)
    }
  }

  const materials = await listRawMaterials()
  const matName = new Map(materials.map((m) => [m.id, m]))
  const matAgg = new Map<string, { qty: number; cost: number }>()
  for (const b of batches) {
    const q = Number(b.original_quantity)
    const c = q * Number(b.unit_cost)
    const cur = matAgg.get(b.raw_material_id) ?? { qty: 0, cost: 0 }
    cur.qty += q
    cur.cost += c
    matAgg.set(b.raw_material_id, cur)
  }

  const purchaseMaterials: PurchaseMaterialLine[] = [...matAgg.entries()].map(([id, v]) => {
    const m = matName.get(id)
    return {
      materialId: id,
      name: m?.name ?? 'Material',
      quantity: v.qty,
      unit: m?.unit ?? 'kg',
      totalPaid: v.cost,
      avgUnitPrice: v.qty > 0 ? v.cost / v.qty : 0,
    }
  })

  const purchasesReport: PurchasesReportData = {
    totalPaid: purchaseTxs.reduce((s, p) => s + Number(p.total_amount), 0),
    purchaseCount: purchaseTxs.length,
    totalQuantityKg: purchaseMaterials.reduce((s, m) => s + (m.unit === 'kg' ? m.quantity : 0), 0),
    materials: purchaseMaterials.sort((a, b) => b.totalPaid - a.totalPaid),
  }

  const prodRows = await paginate(async (pageFrom, pageTo) => {
    const { data, error } = await supabase
      .from('production_batches')
      .select(
        'id, production_date, oil_output_litres, waste_output_kg, effective_production_cost, cost_per_litre, output_product_id, product:products(name)',
      )
      .gte('production_date', from)
      .lte('production_date', to)
      .order('production_date', { ascending: false })
      .range(pageFrom, pageTo)
    if (error) throw error
    return (data ?? []).map((p) => ({
      ...p,
      product: normalizeOne(p.product as { name: string } | { name: string }[] | null),
    })) as {
      id: string
      production_date: string
      oil_output_litres: number
      waste_output_kg: number
      effective_production_cost: number
      cost_per_litre: number
      output_product_id: string
      product: { name: string } | null
    }[]
  })

  const prodIds = prodRows.map((p) => p.id)
  const inputByBatch = new Map<string, number>()
  if (prodIds.length > 0) {
    const chunk = 200
    for (let i = 0; i < prodIds.length; i += chunk) {
      const ids = prodIds.slice(i, i + chunk)
      const { data, error } = await supabase
        .from('production_inputs')
        .select('production_batch_id, quantity')
        .in('production_batch_id', ids)
      if (error) throw error
      for (const row of data ?? []) {
        const bid = row.production_batch_id as string
        inputByBatch.set(bid, (inputByBatch.get(bid) ?? 0) + Number(row.quantity))
      }
    }
  }

  const byProd = new Map<string, ProductionByProduct>()
  const batchLines: ProductionBatchLine[] = prodRows.map((p) => {
    const oil = Number(p.oil_output_litres)
    const waste = Number(p.waste_output_kg)
    const cost = Number(p.effective_production_cost)
    const name = p.product?.name ?? 'Oil'
    const cur = byProd.get(p.output_product_id) ?? {
      productId: p.output_product_id,
      name,
      oilLitres: 0,
      wasteKg: 0,
      totalCost: 0,
    }
    cur.oilLitres += oil
    cur.wasteKg += waste
    cur.totalCost += cost
    byProd.set(p.output_product_id, cur)
    return {
      id: p.id,
      batchLabel: `${p.production_date}_${oil % 1 === 0 ? oil : oil.toFixed(2)}L`,
      date: p.production_date,
      productName: name,
      inputKg: inputByBatch.get(p.id) ?? 0,
      oilLitres: oil,
      wasteKg: waste,
      totalCost: cost,
      costPerLitre: Number(p.cost_per_litre),
    }
  })

  const productionReport: ProductionReportData = {
    batchCount: prodRows.length,
    totalOilLitres: prodRows.reduce((s, p) => s + Number(p.oil_output_litres), 0),
    totalWasteKg: prodRows.reduce((s, p) => s + Number(p.waste_output_kg), 0),
    totalCost: prodRows.reduce((s, p) => s + Number(p.effective_production_cost), 0),
    byProduct: [...byProd.values()],
    batches: batchLines,
  }

  const expenseRows = await paginate(async (pageFrom, pageTo) => {
    const { data, error } = await supabase
      .from('expenses')
      .select('amount, account:financial_accounts(account_type), category:expense_categories(name)')
      .gte('expense_date', from)
      .lte('expense_date', to)
      .order('expense_date', { ascending: false })
      .range(pageFrom, pageTo)
    if (error) throw error
    return (data ?? []).map((e) => ({
      amount: Number(e.amount),
      account: normalizeOne(e.account as { account_type: string } | { account_type: string }[] | null),
      category: normalizeOne(e.category as { name: string } | { name: string }[] | null),
    }))
  })

  const catMap = new Map<string, number>()
  let expCash = 0
  let expUpi = 0
  let expBank = 0
  for (const e of expenseRows) {
    const amt = Number(e.amount)
    const cat = e.category?.name ?? 'Other'
    catMap.set(cat, (catMap.get(cat) ?? 0) + amt)
    const t = e.account?.account_type
    if (t === 'cash') expCash += amt
    else if (t === 'upi') expUpi += amt
    else if (t === 'bank') expBank += amt
    else expCash += amt
  }

  const expensesReport: ExpensesReportData = {
    total: expenseRows.reduce((s, e) => s + Number(e.amount), 0),
    count: expenseRows.length,
    cashTotal: expCash,
    upiTotal: expUpi,
    bankTotal: expBank,
    byCategory: [...catMap.entries()]
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount),
  }

  const [purchaseBatches, productionBatches, movements, products, packagesRes] = await Promise.all([
    listPurchaseBatches(),
    listProductionBatches(),
    listStockMovements(50_000),
    listProducts(),
    supabase.from('product_packages').select('id, label, product_id'),
  ])
  if (packagesRes.error) throw packagesRes.error

  const rawTotals = aggregateRawMaterialTotals(purchaseBatches)
  const packaged = aggregatePackagedStock(movements, productionBatches)
  const wasteMap = aggregateWasteStock(movements)
  const pkgList = packagesRes.data ?? []
  const prodName = new Map(products.map((p) => [p.id, p.name]))

  const rawLines = materials
    .map((m) => {
      const batchesForMat = purchaseBatches.filter((b) => b.raw_material_id === m.id && Number(b.remaining_quantity) > 0)
      let weighted = 0
      let qty = 0
      for (const b of batchesForMat) {
        const rq = Number(b.remaining_quantity)
        weighted += rq * Number(b.unit_cost)
        qty += rq
      }
      return {
        name: m.name,
        qty: rawTotals.get(m.id) ?? 0,
        unit: m.unit,
        avgCost: qty > 0 ? weighted / qty : 0,
        batchCount: batchesForMat.length,
      }
    })
    .filter((r) => r.qty > 0)

  const bulkByProduct = new Map<string, { litres: number; batches: number }>()
  for (const b of productionBatches) {
    const rem = Number(b.remaining_bulk_litres)
    if (rem <= 0) continue
    const cur = bulkByProduct.get(b.output_product_id) ?? { litres: 0, batches: 0 }
    cur.litres += rem
    cur.batches += 1
    bulkByProduct.set(b.output_product_id, cur)
  }

  const pkgAgg = new Map<string, number>()
  for (const row of packaged) {
    const key = row.product_package_id
    pkgAgg.set(key, (pkgAgg.get(key) ?? 0) + row.quantity)
  }

  const packagedLines = [...pkgAgg.entries()].map(([pkgId, qty]) => {
    const pkg = pkgList.find((p) => p.id === pkgId)
    return {
      label: pkg?.label ?? 'Package',
      productName: prodName.get(pkg?.product_id ?? '') ?? '',
      qty,
    }
  })

  const wasteLines = products
    .filter((p) => p.is_waste)
    .map((p) => ({
      name: p.name,
      qty: wasteMap.get(p.id) ?? 0,
      unit: p.unit,
    }))
    .filter((w) => w.qty > 0)

  const totalUnits =
    rawLines.reduce((s, r) => s + r.qty, 0) +
    [...bulkByProduct.values()].reduce((s, b) => s + b.litres, 0) +
    packagedLines.reduce((s, p) => s + p.qty, 0) +
    wasteLines.reduce((s, w) => s + w.qty, 0)

  const stockReport: StockReportData = {
    rawMaterials: rawLines,
    bulkOil: [...bulkByProduct.entries()].map(([pid, v]) => ({
      name: prodName.get(pid) ?? 'Oil',
      litres: v.litres,
      batchCount: v.batches,
    })),
    packaged: packagedLines,
    waste: wasteLines,
    totalUnits: Math.round(totalUnits),
  }

  const expiryItems: ExpiryItem[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const b of purchaseBatches) {
    const rem = Number(b.remaining_quantity)
    if (rem <= 0) continue
    const daysLeft = Math.ceil((new Date(b.expiry_date).getTime() - today.getTime()) / 86400000)
    const bucket: ExpiryBucket =
      daysLeft < 0 ? 'expired' : daysLeft <= 7 ? 'd7' : daysLeft <= 15 ? 'd15' : daysLeft <= 30 ? 'd30' : 'safe'
    expiryItems.push({
      bucket,
      productLabel: matName.get(b.raw_material_id)?.name ?? 'Material',
      batchId: b.batch_code,
      quantity: rem,
      unit: matName.get(b.raw_material_id)?.unit ?? 'kg',
      expiryDate: b.expiry_date,
      daysLeft,
    })
  }

  for (const b of productionBatches) {
    const rem = Number(b.remaining_bulk_litres)
    if (rem <= 0) continue
    const daysLeft = Math.ceil((new Date(b.expiry_date).getTime() - today.getTime()) / 86400000)
    const bucket: ExpiryBucket =
      daysLeft < 0 ? 'expired' : daysLeft <= 7 ? 'd7' : daysLeft <= 15 ? 'd15' : daysLeft <= 30 ? 'd30' : 'safe'
    expiryItems.push({
      bucket,
      productLabel: prodName.get(b.output_product_id) ?? 'Bulk oil',
      batchId: `${b.production_date}_${rem}L`,
      quantity: rem,
      unit: 'L',
      expiryDate: b.expiry_date,
      daysLeft,
    })
  }

  expiryItems.sort((a, b) => a.daysLeft - b.daysLeft)
  const attention = expiryItems.filter((i) => i.bucket !== 'safe')
  const expiryReport: ExpiryReportData = {
    needAttention: attention.length,
    expired: expiryItems.filter((i) => i.bucket === 'expired').length,
    under7: expiryItems.filter((i) => i.bucket === 'd7').length,
    under30: expiryItems.filter((i) => i.daysLeft >= 0 && i.daysLeft <= 30).length,
    items: expiryItems,
  }

  const [salesProfit, expensesProfit, crushingProfit, crushingRows, money, accounts, allTxs] =
    await Promise.all([
      fetchSalesForProfitRange(from, to),
      fetchExpensesForProfitRange(from, to),
      fetchCrushingForProfitRange(from, to),
      listCrushing(from, to),
      getMoneyAvailable(),
      listFinancialAccounts(),
      fetchAllFinancialTransactions(),
    ])

  const profit = calculateProfitMetrics(salesProfit, expensesProfit, crushingProfit)
  const flows = computeAccountFlows(accounts, allTxs, from, to, money)

  const customerIds = new Set(crushingRows.map((r) => r.customer_id ?? r.id))
  const crushingReport: CrushingReportData = {
    customersServed: customerIds.size,
    kgCrushed: crushingRows.reduce((s, r) => s + Number(r.input_quantity), 0),
    oilReturned: crushingRows.reduce((s, r) => s + Number(r.oil_output_quantity), 0),
    cakeReturnedKg: crushingRows
      .filter((r) => r.cake_handling === 'customer_takes')
      .reduce((s, r) => s + Number(r.cake_output_quantity), 0),
    cakeBoughtKg: crushingRows
      .filter((r) => r.cake_handling === 'sell_to_mill')
      .reduce((s, r) => s + Number(r.cake_output_quantity), 0),
    crushingIncome: crushingProfit.reduce((s, r) => s + Number(r.crushing_charge), 0),
    cakePurchaseValue: crushingProfit.reduce((s, r) => s + Number(r.cake_purchase_value), 0),
    netSettlementCash: crushingProfit.reduce((s, r) => {
      const charge = Number(r.crushing_charge)
      const cake = Number(r.cake_purchase_value)
      return s + (charge - cake)
    }, 0),
  }

  return {
    range,
    sales: salesReport,
    purchases: purchasesReport,
    production: productionReport,
    expenses: expensesReport,
    crushing: crushingReport,
    stock: stockReport,
    expiry: expiryReport,
    profit,
    money: { ...money, flows },
  }
}
