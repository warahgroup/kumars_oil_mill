import { supabase } from '@/lib/supabase'
import { recordBottling } from '@/services/transactionService'
import { createIdempotencyKey } from '@/lib/idempotency'

export type BottlingListRow = {
  id: string
  transaction_date: string
  package_count: number
  bulk_litres_used: number
  packaging_cost_total: number
  package?: { label: string; product?: { name: string } | null } | null
}

export async function listBottling(): Promise<BottlingListRow[]> {
  const { data, error } = await supabase
    .from('bottling_transactions')
    .select(
      'id, transaction_date, package_count, bulk_litres_used, packaging_cost_total, package:product_packages(label, product:products(name))',
    )
    .order('transaction_date', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as unknown as BottlingListRow[]
}

export async function saveBottling(input: {
  production_batch_id: string
  product_package_id: string
  package_count: number
  transaction_date: string
}): Promise<string> {
  return recordBottling({
    production_batch_id: input.production_batch_id,
    product_package_id: input.product_package_id,
    package_count: input.package_count,
    transaction_date: input.transaction_date,
    idempotency_key: createIdempotencyKey('bottling'),
  })
}
