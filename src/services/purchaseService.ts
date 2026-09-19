import { supabase } from '@/lib/supabase'
import { purchaseCategoryFromCode } from '@/lib/purchaseCategory'
import type { PurchaseCategory } from '@/lib/purchaseCategory'
import type { RawMaterial } from '@/types/entities'
import { recordPurchase } from '@/services/transactionService'
import { listFinancialAccounts } from '@/services/financialService'
import { createIdempotencyKey } from '@/lib/idempotency'
import { formatPurchaseBatchCode } from '@/lib/purchaseBatchCode'

export type PurchaseBatchLine = {
  quantity: number
  unit_cost: number
  raw_material_id?: string
  material?: { name: string; unit: string; code: string } | null
}

function normalizeMaterial(
  value: { name: string; unit: string; code: string } | { name: string; unit: string; code: string }[] | null | undefined,
): PurchaseBatchLine['material'] {
  if (!value) return null
  if (Array.isArray(value)) return value[0] ?? null
  return value
}

function mapBatchLine(b: Record<string, unknown>): PurchaseBatchLine {
  const material =
    normalizeMaterial(b.material as PurchaseBatchLine['material']) ??
    normalizeMaterial(b.raw_materials as PurchaseBatchLine['material'])
  return {
    quantity: Number(b.original_quantity),
    unit_cost: Number(b.unit_cost),
    raw_material_id: typeof b.raw_material_id === 'string' ? b.raw_material_id : undefined,
    material,
  }
}

export type PurchaseListRow = {
  id: string
  transaction_date: string
  total_amount: number
  reference_no: string | null
  notes: string | null
  batches?: PurchaseBatchLine[]
}

export function supplierLabelFromNotes(notes: string | null | undefined): string {
  if (!notes?.trim()) return ''
  const match = notes.match(/Supplier:\s*(.+)/i)
  return match ? match[1].trim() : ''
}

export async function listPurchases(): Promise<PurchaseListRow[]> {
  const { data, error } = await supabase
    .from('purchase_transactions')
    .select(
      `id, transaction_date, total_amount, reference_no, notes,
      purchase_batches(original_quantity, unit_cost, raw_material_id, raw_materials(name, unit, code))`,
    )
    .order('transaction_date', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []).map((row) => {
    const raw = row as Record<string, unknown>
    const batchRows = (raw.purchase_batches ?? raw.batches ?? []) as Record<string, unknown>[]
    const batches = batchRows.map(mapBatchLine)
    return {
      id: String(raw.id),
      transaction_date: String(raw.transaction_date),
      total_amount: Number(raw.total_amount),
      reference_no: (raw.reference_no as string | null) ?? null,
      notes: (raw.notes as string | null) ?? null,
      batches,
    }
  })
}

export function purchaseMatchesCategory(
  row: PurchaseListRow,
  category: PurchaseCategory,
  materials: Pick<RawMaterial, 'id' | 'code'>[] = [],
): boolean {
  const codeById = new Map(materials.map((m) => [m.id, m.code]))
  const codes = (row.batches ?? [])
    .map((b) => b.material?.code ?? (b.raw_material_id ? codeById.get(b.raw_material_id) : undefined))
    .filter(Boolean) as string[]
  if (codes.length === 0) return category === 'raw'
  return codes.some((code) => purchaseCategoryFromCode(code) === category)
}

export type SavePurchaseInput = {
  raw_material_id: string
  supplier_name?: string
  quantity: number
  total_amount: number
  transaction_date: string
  expiry_date?: string
  financial_account_id?: string
}

async function resolveCashAccountId(): Promise<string> {
  const accounts = await listFinancialAccounts()
  const cash = accounts.find((a) => a.account_type === 'cash')
  const id = cash?.id ?? accounts[0]?.id
  if (!id) throw new Error('No payment account set up. Add a cash account in settings.')
  return id
}

export async function savePurchase(input: SavePurchaseInput): Promise<string> {
  const unit_cost = input.total_amount / input.quantity
  const idempotency_key = createIdempotencyKey('purchase')
  const notes = input.supplier_name?.trim() ? `Supplier: ${input.supplier_name.trim()}` : undefined
  const financial_account_id = input.financial_account_id ?? (await resolveCashAccountId())

  return recordPurchase({
    transaction_date: input.transaction_date,
    financial_account_id,
    idempotency_key,
    notes,
    lines: [
      {
        raw_material_id: input.raw_material_id,
        quantity: input.quantity,
        unit_cost,
        purchase_date: input.transaction_date,
        expiry_date: input.expiry_date ?? null,
        batch_code: formatPurchaseBatchCode(input.transaction_date, input.quantity),
      },
    ],
  })
}
