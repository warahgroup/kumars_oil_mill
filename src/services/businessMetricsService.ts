import { getAllAccountBalances, type FinancialAccount } from '@/services/financialService'
import { supabase } from '@/lib/supabase'

export type ProfitMetrics = {
  productSales: number
  crushingIncome: number
  revenue: number
  productCost: number
  grossProfit: number
  businessExpenses: number
  netProfit: number
}

export type SaleRowForMetrics = { total_amount: number; total_cogs: number }
export type ExpenseRowForMetrics = { amount: number }
export type CrushingRowForMetrics = { crushing_charge: number }

/** Shared profit math for Home, Reports, and anywhere else. */
export function calculateProfitMetrics(
  sales: SaleRowForMetrics[],
  expenses: ExpenseRowForMetrics[],
  crushing: CrushingRowForMetrics[] = [],
): ProfitMetrics {
  const productSales = sales.reduce((s, r) => s + Number(r.total_amount), 0)
  const crushingIncome = crushing.reduce((s, r) => s + Number(r.crushing_charge), 0)
  const revenue = productSales + crushingIncome
  const productCost = sales.reduce((s, r) => s + Number(r.total_cogs), 0)
  const grossProfit = revenue - productCost
  const businessExpenses = expenses.reduce((s, r) => s + Number(r.amount), 0)
  return {
    productSales,
    crushingIncome,
    revenue,
    productCost,
    grossProfit,
    businessExpenses,
    netProfit: grossProfit - businessExpenses,
  }
}

export type FinancialTxRow = {
  financial_account_id: string
  transaction_date: string
  direction: 'in' | 'out'
  amount: number
  reference_kind: string
}

export async function fetchAllFinancialTransactions(): Promise<FinancialTxRow[]> {
  const pageSize = 1000
  let from = 0
  const all: FinancialTxRow[] = []
  for (;;) {
    const { data, error } = await supabase
      .from('financial_transactions')
      .select('financial_account_id, transaction_date, direction, amount, reference_kind')
      .order('transaction_date', { ascending: true })
      .range(from, from + pageSize - 1)
    if (error) throw error
    const rows = (data ?? []) as FinancialTxRow[]
    all.push(...rows)
    if (rows.length < pageSize) break
    from += pageSize
  }
  return all
}

export type AccountMoneyFlow = {
  accountType: 'cash' | 'upi' | 'bank'
  title: string
  openingInPeriod: number
  salesIn: number
  crushingIn: number
  purchasesOut: number
  expensesOut: number
  crushingCakeOut: number
  otherIn: number
  otherOut: number
  closingInPeriod: number
  currentBalance: number
}

function sumByKind(
  rows: FinancialTxRow[],
  accountId: string,
  from: string,
  to: string,
  direction: 'in' | 'out',
  kinds: string[],
): number {
  return rows
    .filter(
      (t) =>
        t.financial_account_id === accountId &&
        t.direction === direction &&
        t.transaction_date >= from &&
        t.transaction_date <= to &&
        kinds.includes(t.reference_kind),
    )
    .reduce((s, t) => s + Number(t.amount), 0)
}

function balanceBeforeDate(
  account: FinancialAccount,
  txs: FinancialTxRow[],
  periodFromIso: string,
): number {
  let bal = Number(account.opening_balance)
  for (const t of txs) {
    if (t.financial_account_id !== account.id) continue
    if (t.transaction_date < periodFromIso) {
      bal += t.direction === 'in' ? Number(t.amount) : -Number(t.amount)
    }
  }
  return bal
}

/** Opening balance at start of `from` (inclusive period starts at from). */
export function computeAccountFlows(
  accounts: FinancialAccount[],
  txs: FinancialTxRow[],
  from: string,
  to: string,
  currentBalances: { cash: number; upi: number; bank: number },
): AccountMoneyFlow[] {
  const titles: Record<string, string> = { cash: 'Cash', upi: 'UPI', bank: 'Bank' }
  return accounts.map((acc) => {
    const openingInPeriod = balanceBeforeDate(acc, txs, from)
    const salesIn = sumByKind(txs, acc.id, from, to, 'in', ['sale'])
    const crushingIn = sumByKind(txs, acc.id, from, to, 'in', ['crushing'])
    const purchasesOut = sumByKind(txs, acc.id, from, to, 'out', ['purchase'])
    const expensesOut = sumByKind(txs, acc.id, from, to, 'out', ['expense'])
    const crushingCakeOut = sumByKind(txs, acc.id, from, to, 'out', ['crushing'])
    const otherIn = sumByKind(txs, acc.id, from, to, 'in', [
      'production',
      'bottling',
      'adjustment',
      'opening',
    ])
    const otherOut = sumByKind(txs, acc.id, from, to, 'out', [
      'production',
      'bottling',
      'adjustment',
    ])
    const closingInPeriod =
      openingInPeriod +
      salesIn +
      crushingIn -
      purchasesOut -
      expensesOut -
      crushingCakeOut +
      otherIn -
      otherOut
    const currentBalance = currentBalances[acc.account_type]
    return {
      accountType: acc.account_type,
      title: titles[acc.account_type] ?? acc.name,
      openingInPeriod,
      salesIn,
      crushingIn,
      purchasesOut,
      expensesOut,
      crushingCakeOut,
      otherIn,
      otherOut,
      closingInPeriod,
      currentBalance,
    }
  })
}

export async function getMoneyAvailable(): Promise<{ cash: number; upi: number; bank: number; total: number }> {
  const balances = await getAllAccountBalances()
  return {
    ...balances,
    total: balances.cash + balances.upi + balances.bank,
  }
}

export async function fetchSalesForProfitRange(from: string, to: string) {
  const { data, error } = await supabase
    .from('sales')
    .select('total_amount, total_cogs')
    .gte('sale_date', from)
    .lte('sale_date', to)
  if (error) throw error
  return data ?? []
}

export async function fetchExpensesForProfitRange(from: string, to: string) {
  const { data, error } = await supabase
    .from('expenses')
    .select('amount')
    .gte('expense_date', from)
    .lte('expense_date', to)
  if (error) throw error
  return data ?? []
}
