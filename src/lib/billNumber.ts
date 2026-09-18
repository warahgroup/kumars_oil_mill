export function generateBillNumber(sequence: number): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const seq = String(sequence).padStart(4, '0')
  return `BILL-${y}${m}${day}-${seq}`
}
