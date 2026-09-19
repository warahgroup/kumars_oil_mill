import { invalidateDataCache } from '@/lib/dataCache'
import { supabase } from '@/lib/supabase'
import { createIdempotencyKey } from '@/lib/idempotency'
import type { CrushingSettings } from '@/lib/crushingConfig'
import { CRUSHING_WALK_IN_CUSTOMER_NAME, DEFAULT_CRUSHING_SETTINGS } from '@/lib/crushingConfig'
import { listCustomers, upsertCustomer } from '@/services/masterDataService'

export type CrushingRow = {
  id: string
  customer_id?: string
  transaction_code: string
  crushing_rate_per_kg?: number
  cake_purchase_rate_per_kg?: number | null
  crushing_date: string
  input_quantity: number
  oil_output_quantity: number
  cake_output_quantity: number
  cake_handling: 'customer_takes' | 'sell_to_mill'
  crushing_charge: number
  cake_purchase_value: number
  net_settlement_amount: number
  settlement_direction: 'customer_pays_mill' | 'mill_pays_customer' | 'settled'
  status: string
  notes: string | null
  customer?: { name: string; phone: string | null } | null
  raw_material?: { name: string; code: string; unit: string } | null
  account?: { name: string; account_type: string } | null
}

export async function getCrushingWalkInCustomerId(): Promise<string> {
  const rows = await listCustomers(CRUSHING_WALK_IN_CUSTOMER_NAME)
  const existing = rows.find((c) => c.name === CRUSHING_WALK_IN_CUSTOMER_NAME)
  if (existing) return existing.id
  const created = await upsertCustomer({
    name: CRUSHING_WALK_IN_CUSTOMER_NAME,
    customer_type: 'retail',
  })
  return created.id
}

export function crushingCustomerDisplayName(name: string | undefined | null): string | null {
  if (!name || name === CRUSHING_WALK_IN_CUSTOMER_NAME) return null
  return name
}

export async function listCrushing(from?: string, to?: string): Promise<CrushingRow[]> {
  let q = supabase
    .from('crushing_transactions')
    .select(
      `id, customer_id, transaction_code, crushing_date, input_quantity, oil_output_quantity, cake_output_quantity,
      cake_handling, crushing_charge, cake_purchase_value, net_settlement_amount, settlement_direction,
      status, notes,
      customer:customers(name, phone),
      raw_material:raw_materials(name, code, unit)`,
    )
    .eq('status', 'completed')
    .order('crushing_date', { ascending: false })
  if (from) q = q.gte('crushing_date', from)
  if (to) q = q.lte('crushing_date', to)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as unknown as CrushingRow[]
}

export async function getCrushing(id: string): Promise<CrushingRow | null> {
  const { data, error } = await supabase
    .from('crushing_transactions')
    .select(
      `id, customer_id, transaction_code, crushing_date, input_quantity, oil_output_quantity, cake_output_quantity,
      cake_handling, crushing_charge, cake_purchase_value, net_settlement_amount, settlement_direction,
      crushing_rate_per_kg, cake_purchase_rate_per_kg, status, notes,
      customer:customers(name, phone),
      raw_material:raw_materials(name, code, unit),
      account:financial_accounts(name, account_type)`,
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data as CrushingRow | null
}

export type SaveCrushingInput = {
  customer_id: string
  raw_material_id: string
  crushing_date: string
  input_quantity: number
  oil_output_quantity: number
  cake_output_quantity: number
  cake_handling: 'customer_takes' | 'sell_to_mill'
  crushing_rate_per_kg: number
  cake_purchase_rate_per_kg?: number
  financial_account_id: string
  notes?: string
}

export async function saveCrushing(input: SaveCrushingInput): Promise<string> {
  const { data, error } = await supabase.rpc('record_crushing', {
    p_payload: {
      ...input,
      idempotency_key: createIdempotencyKey('crushing'),
    },
  })
  if (error) throw error
  invalidateDataCache()
  return data as string
}

export async function getCrushingSettings(): Promise<CrushingSettings> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('business_settings')
    .select('crushing_settings')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) {
    if (error.code === '42703' || error.message.includes('crushing_settings')) {
      return { ...DEFAULT_CRUSHING_SETTINGS }
    }
    throw error
  }
  const raw = data?.crushing_settings as CrushingSettings | null
  return {
    charge_per_kg_by_raw_code: {
      ...DEFAULT_CRUSHING_SETTINGS.charge_per_kg_by_raw_code,
      ...(raw?.charge_per_kg_by_raw_code ?? {}),
    },
    cake_rate_by_product_code: {
      ...DEFAULT_CRUSHING_SETTINGS.cake_rate_by_product_code,
      ...(raw?.cake_rate_by_product_code ?? {}),
    },
  }
}

export async function updateCrushingSettings(settings: CrushingSettings): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { error } = await supabase
    .from('business_settings')
    .update({ crushing_settings: settings })
    .eq('user_id', user.id)
  if (error) throw error
}

export async function fetchCrushingForProfitRange(from: string, to: string) {
  const { data, error } = await supabase
    .from('crushing_transactions')
    .select('crushing_charge, cake_purchase_value, net_settlement_amount, settlement_direction')
    .eq('status', 'completed')
    .gte('crushing_date', from)
    .lte('crushing_date', to)
  if (error) throw error
  return data ?? []
}
