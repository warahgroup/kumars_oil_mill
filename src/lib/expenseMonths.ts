import { localIsoDate } from '@/lib/dateRangeFilter'

export function monthKeyFromIsoDate(isoDate: string): string {
  return isoDate.slice(0, 7)
}

export function currentMonthKey(): string {
  return localIsoDate().slice(0, 7)
}

export function monthDateRange(monthKey: string): { from: string; to: string } {
  const [y, m] = monthKey.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return {
    from: `${monthKey}-01`,
    to: `${monthKey}-${String(lastDay).padStart(2, '0')}`,
  }
}

export function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export type ExpenseMonthSummary = {
  monthKey: string
  label: string
  total: number
  count: number
}

export function summarizeByMonth(
  rows: { expense_date: string; amount: number }[],
): ExpenseMonthSummary[] {
  const map = new Map<string, { total: number; count: number }>()
  for (const row of rows) {
    const key = monthKeyFromIsoDate(row.expense_date)
    const cur = map.get(key) ?? { total: 0, count: 0 }
    cur.total += Number(row.amount)
    cur.count += 1
    map.set(key, cur)
  }
  return [...map.entries()]
    .map(([monthKey, v]) => ({
      monthKey,
      label: formatMonthLabel(monthKey),
      total: v.total,
      count: v.count,
    }))
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
}

export function isDateInMonth(isoDate: string, monthKey: string): boolean {
  return monthKeyFromIsoDate(isoDate) === monthKey
}
