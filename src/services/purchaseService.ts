import { supabase } from '@/lib/supabase'
import { recordPurchase } from '@/services/transactionService'
import { createIdempotencyKey } from '@/lib/idempotency'

export type PurchaseListRow = {
  id: string
  transaction_date: string
  total_amount: number
  reference_no: string | null
  supplier?: { name: string } | null
  financial_account?: { name: string; account_type: string } | null
}

export async function listPurchases(): Promise<PurchaseListRow[]> {
  const { data, error } = await supabase
    .from('purchase_transactions')
    .select(
      'id, transaction_date, total_amount, reference_no, supplier:suppliers(name), financial_account:financial_accounts(name, account_type)',
    )
    .order('transaction_date', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as unknown as PurchaseListRow[]
}

export type SavePurchaseInput = {
  raw_material_id: string
  supplier_id?: string
  quantity: number
  total_amount: number
  transaction_date: string
  expiry_date?: string
  financial_account_id: string
}

export async function savePurchase(input: SavePurchaseInput): Promise<string> {
  const unit_cost = input.total_amount / input.quantity
  const idempotency_key = createIdempotencyKey('purchase')
  return recordPurchase({
    supplier_id: input.supplier_id ?? null,
    transaction_date: input.transaction_date,
    financial_account_id: input.financial_account_id,
    idempotency_key,
    lines: [
      {
        raw_material_id: input.raw_material_id,
        quantity: input.quantity,
        unit_cost,
        purchase_date: input.transaction_date,
        expiry_date: input.expiry_date ?? null,
      },
    ],
  })
}
