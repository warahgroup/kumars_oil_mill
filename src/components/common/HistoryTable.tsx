import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'

type Column<T> = { key: string; header: string; render: (row: T) => ReactNode; primary?: boolean }

type HistoryTableProps<T> = {
  rows: T[]
  columns: Column<T>[]
  emptyMessage: string
}

export function HistoryTable<T extends { id: string }>({
  rows,
  columns,
  emptyMessage,
}: HistoryTableProps<T>) {
  if (rows.length === 0) {
    return (
      <Card className="text-center text-sm text-slate-500">{emptyMessage}</Card>
    )
  }

  const primaryCol = columns.find((c) => c.primary) ?? columns[0]

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm">
      <div className="hidden md:block">
        <table className="w-full text-left text-sm">
          <thead className="bg-brand-50 text-brand-800">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="px-4 py-3 font-semibold">{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-brand-50 hover:bg-brand-50/50">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 text-brand-900">{c.render(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 p-3 md:hidden">
        {rows.map((row) => (
          <Card key={row.id} padding="normal" className="shadow-none">
            <p className="text-base font-bold text-brand-900">{primaryCol.render(row)}</p>
            <dl className="mt-2 space-y-1.5">
              {columns
                .filter((c) => c.key !== primaryCol.key)
                .map((c) => (
                  <div key={c.key} className="flex justify-between gap-3 text-sm">
                    <dt className="text-slate-500">{c.header}</dt>
                    <dd className="font-medium text-brand-900">{c.render(row)}</dd>
                  </div>
                ))}
            </dl>
          </Card>
        ))}
      </div>
    </div>
  )
}
