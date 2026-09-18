import { invalidateDataCache } from '@/lib/dataCache'
import { supabase } from '@/lib/supabase'

export type BusinessValidation = {
  purchase_total: number
  sales_subtotal: number
  sales_total: number
  expenses_total: number
  cogs: number
  gross_profit: number
  net_profit: number
  cash_balance: number
  upi_balance: number
  bank_balance: number
  negative_purchase_batches: number
  negative_bulk_batches: number
  expiry_alerts: number
}

export async function loadSevenDayDemoData(): Promise<BusinessValidation> {
  const { data, error } = await supabase.rpc('load_seven_day_demo_data')
  if (error) throw error
  invalidateDataCache()
  return data as BusinessValidation
}

export async function clearAllBusinessData(confirmation: string): Promise<void> {
  const { error } = await supabase.rpc('clear_user_business_data', {
    p_confirmation: confirmation,
  })
  if (error) throw error
  invalidateDataCache()
}

export async function validateBusinessData(): Promise<BusinessValidation> {
  const { data, error } = await supabase.rpc('validate_business_data')
  if (error) throw error
  return data as BusinessValidation
}

export async function getDemoDataStatus(): Promise<{
  loaded: boolean
  loadedAt: string | null
  version: string | null
}> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { loaded: false, loadedAt: null, version: null }

  const { data, error } = await supabase
    .from('business_settings')
    .select('demo_data_loaded_at, demo_data_version')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) throw error
  return {
    loaded: Boolean(data?.demo_data_loaded_at),
    loadedAt: data?.demo_data_loaded_at ?? null,
    version: data?.demo_data_version ?? null,
  }
}
