/** Purchase batch label: `YYYY-MM-DD_quantity` (e.g. `2026-09-19_50`). */
export function formatPurchaseBatchCode(transactionDate: string, quantity: number): string {
  const q = Number(quantity)
  if (!Number.isFinite(q) || q <= 0) return transactionDate
  const qStr =
    Math.abs(q - Math.round(q)) < 1e-9 ? String(Math.round(q)) : String(Number(q.toFixed(3)))
  return `${transactionDate}_${qStr}`
}
