import { useQuery } from '@/hooks/useQuery'
import { listFinancialAccounts } from '@/services/financialService'
import type { AccountType } from '@/types/entities'

export function usePaymentAccounts() {
  return useQuery(() => listFinancialAccounts(), [])
}

export function accountIdByType(
  accounts: { id: string; account_type: AccountType }[],
  type: AccountType,
): string {
  return accounts.find((a) => a.account_type === type)?.id ?? ''
}
