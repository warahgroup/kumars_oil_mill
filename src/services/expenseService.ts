import { supabase } from '@/lib/supabase'
import { recordExpense } from '@/services/transactionService'
import { createIdempotencyKey } from '@/lib/idempotency'

export type ExpenseListRow = {
  id: string
  expense_date: string
  amount: number
  description: string | null
  category?: { name: string } | null
  account?: { name: string; account_type: string } | null
}

export async function listExpenses(): Promise<ExpenseListRow[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(
      'id, expense_date, amount, description, category:expense_categories(name), account:financial_accounts(name, account_type)',
    )
    .order('expense_date', { ascending: false })
    .limit(200)
  if (error) throw error
  return (data ?? []) as unknown as ExpenseListRow[]
}

export async function saveExpense(input: {
  expense_category_id: string
  amount: number
  financial_account_id: string
  expense_date: string
  description?: string
}): Promise<string> {
  return recordExpense({
    expense_category_id: input.expense_category_id,
    amount: input.amount,
    financial_account_id: input.financial_account_id,
    expense_date: input.expense_date,
    description: input.description ?? null,
    idempotency_key: createIdempotencyKey('expense'),
  })
}
