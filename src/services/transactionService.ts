import { invalidateDataCache } from '@/lib/dataCache'
import { supabase } from '@/lib/supabase'

function afterBusinessMutation<T>(result: T): T {
  invalidateDataCache()
  return result
}

export async function recordPurchase(payload: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.rpc('record_purchase', { p_payload: payload })
  if (error) throw error
  return afterBusinessMutation(data as string)
}

export async function recordProduction(payload: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.rpc('record_production', { p_payload: payload })
  if (error) throw error
  return afterBusinessMutation(data as string)
}

export async function recordBottling(payload: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.rpc('record_bottling', { p_payload: payload })
  if (error) throw error
  return afterBusinessMutation(data as string)
}

export async function recordSale(payload: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.rpc('record_sale', { p_payload: payload })
  if (error) throw error
  return afterBusinessMutation(data as string)
}

export async function recordExpense(payload: Record<string, unknown>): Promise<string> {
  const { data, error } = await supabase.rpc('record_expense', { p_payload: payload })
  if (error) throw error
  return afterBusinessMutation(data as string)
}
