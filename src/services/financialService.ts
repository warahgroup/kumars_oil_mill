import { cachedQuery } from '@/lib/dataCache'
import { supabase } from '@/lib/supabase'

export type FinancialAccount = {
  id: string
  name: string
  account_type: 'cash' | 'upi' | 'bank'
  opening_balance: number
}

export async function listFinancialAccounts(): Promise<FinancialAccount[]> {
  return cachedQuery('financial:accounts', async () => {
    const { data, error } = await supabase
      .from('financial_accounts')
      .select('id, name, account_type, opening_balance')
      .eq('active', true)
      .order('account_type')

    if (error) throw error
    return data ?? []
  })
}

/** One query for all account balances (avoids 3 separate RPC round-trips). */
export async function getAllAccountBalances(): Promise<{
  cash: number
  upi: number
  bank: number
}> {
  return cachedQuery('financial:balances', async () => {
    const accounts = await listFinancialAccounts()
    const { data: txs, error } = await supabase
      .from('financial_transactions')
      .select('financial_account_id, direction, amount')

    if (error) throw error

    const balanceById = new Map<string, number>()
    for (const a of accounts) {
      balanceById.set(a.id, Number(a.opening_balance))
    }
    for (const tx of txs ?? []) {
      const id = tx.financial_account_id as string
      const delta = tx.direction === 'in' ? Number(tx.amount) : -Number(tx.amount)
      balanceById.set(id, (balanceById.get(id) ?? 0) + delta)
    }

    const pick = (type: 'cash' | 'upi' | 'bank') => {
      const acc = accounts.find((a) => a.account_type === type)
      return acc ? balanceById.get(acc.id) ?? 0 : 0
    }

    return { cash: pick('cash'), upi: pick('upi'), bank: pick('bank') }
  }, 30_000)
}

export async function getAccountBalance(accountId: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_account_balance', {
    p_account_id: accountId,
  })
  if (error) throw error
  return Number(data ?? 0)
}
