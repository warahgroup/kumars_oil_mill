import { cachedQuery } from '@/lib/dataCache'
import { supabase } from '@/lib/supabase'
import { recordSale } from '@/services/transactionService'
import { createIdempotencyKey } from '@/lib/idempotency'
import { generateBillNumber } from '@/lib/billNumber'
import {
  aggregatePackagedStock,
  listProductionBatches,
  listStockMovements,
  type PackagedStockRow,
} from '@/services/stockService'

export type SaleListRow = {
  id: string
  sale_date: string
  reference_no: string | null
  total_amount: number
  subtotal: number
  total_cogs: number
  customer?: { name: string } | null
  account?: { name: string; account_type: string } | null
}

export async function listSales(): Promise<SaleListRow[]> {
  return cachedQuery('sales:list', async () => {
    const { data, error } = await supabase
      .from('sales')
      .select(
        'id, sale_date, reference_no, total_amount, subtotal, total_cogs, customer:customers(name), account:financial_accounts(name, account_type)',
      )
      .order('sale_date', { ascending: false })
      .limit(200)
    if (error) throw error
    return (data ?? []) as unknown as SaleListRow[]
  }, 30_000)
}

export async function getSaleDetail(saleId: string) {
  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .select(
      '*, customer:customers(name, phone, address), account:financial_accounts(name, account_type)',
    )
    .eq('id', saleId)
    .single()
  if (saleError) throw saleError

  const { data: items, error: itemsError } = await supabase
    .from('sale_items')
    .select(
      '*, product:products(name, unit), package:product_packages(label)',
    )
    .eq('sale_id', saleId)
  if (itemsError) throw itemsError

  return { sale, items: items ?? [] }
}

export async function countSalesToday(): Promise<number> {
  const day = new Date().toISOString().slice(0, 10)
  const { count, error } = await supabase
    .from('sales')
    .select('id', { count: 'exact', head: true })
    .eq('sale_date', day)
  if (error) throw error
  return count ?? 0
}

export type CartLine = {
  product_id: string
  product_package_id?: string
  production_batch_id: string
  quantity: number
  unit_price: number
  is_bulk_sale: boolean
}

export async function getPackagedAvailability(): Promise<PackagedStockRow[]> {
  const [movements, batches] = await Promise.all([
    listStockMovements(),
    listProductionBatches(),
  ])
  return aggregatePackagedStock(movements, batches)
}

export function allocatePackagedFefo(
  availability: PackagedStockRow[],
  productPackageId: string,
  quantity: number,
): { production_batch_id: string; quantity: number }[] {
  const rows = availability
    .filter((r) => r.product_package_id === productPackageId && r.quantity > 0)
    .sort((a, b) => a.expiry_date.localeCompare(b.expiry_date))

  let remaining = quantity
  const allocations: { production_batch_id: string; quantity: number }[] = []
  for (const row of rows) {
    if (remaining <= 0) break
    const take = Math.min(remaining, row.quantity)
    if (take > 0) {
      allocations.push({ production_batch_id: row.production_batch_id, quantity: take })
      remaining -= take
    }
  }
  if (remaining > 0) throw new Error('Insufficient packaged stock')
  return allocations
}

export async function allocateBulkFefo(
  productId: string,
  litres: number,
): Promise<{ production_batch_id: string; quantity: number }[]> {
  const { data, error } = await supabase
    .from('production_batches')
    .select('id, remaining_bulk_litres, expiry_date, output_product_id')
    .eq('output_product_id', productId)
    .gt('remaining_bulk_litres', 0)
    .gte('expiry_date', new Date().toISOString().slice(0, 10))
    .order('expiry_date')
  if (error) throw error

  let remaining = litres
  const allocations: { production_batch_id: string; quantity: number }[] = []
  for (const row of data ?? []) {
    const take = Math.min(remaining, Number(row.remaining_bulk_litres))
    if (take > 0) {
      allocations.push({ production_batch_id: row.id, quantity: take })
      remaining -= take
    }
    if (remaining <= 0) break
  }
  if (remaining > 0) throw new Error('Insufficient bulk oil stock')
  return allocations
}

export async function saveSale(input: {
  customer_id?: string
  sale_date: string
  financial_account_id: string
  discount?: number
  lines: CartLine[]
}): Promise<string> {
  const billNo = generateBillNumber((await countSalesToday()) + 1)
  const rpcLines = input.lines.map((l) => ({
    product_id: l.product_id,
    product_package_id: l.product_package_id ?? null,
    production_batch_id: l.production_batch_id,
    quantity: l.quantity,
    unit_price: l.unit_price,
    is_bulk_sale: l.is_bulk_sale,
  }))

  return recordSale({
    customer_id: input.customer_id ?? null,
    sale_date: input.sale_date,
    financial_account_id: input.financial_account_id,
    reference_no: billNo,
    discount: input.discount ?? 0,
    idempotency_key: createIdempotencyKey('sale'),
    lines: rpcLines,
  })
}

export async function listCustomerSales(customerId: string) {
  const { data, error } = await supabase
    .from('sales')
    .select('id, sale_date, reference_no, total_amount')
    .eq('customer_id', customerId)
    .order('sale_date', { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}
