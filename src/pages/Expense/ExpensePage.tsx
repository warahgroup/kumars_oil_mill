import { useEffect, useMemo, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { HistoryTable } from '@/components/common/HistoryTable'
import { PageShell } from '@/components/common/PageShell'
import { PageState } from '@/components/common/PageState'
import { formatCurrency, formatDate } from '@/lib/format'
import { localIsoDate } from '@/lib/dateRangeFilter'
import {
  currentMonthKey,
  formatMonthLabel,
  isDateInMonth,
  monthDateRange,
  summarizeByMonth,
} from '@/lib/expenseMonths'
import { useQuery } from '@/hooks/useQuery'
import { useSubmit } from '@/hooks/useSubmit'
import { listExpenseCategories } from '@/services/masterDataService'
import { listExpenses, saveExpense, type ExpenseListRow } from '@/services/expenseService'

export default function ExpensePage() {
  const submit = useSubmit()
  const expensesQuery = useQuery(() => listExpenses(), [])

  const [categories, setCategories] = useState<Awaited<ReturnType<typeof listExpenseCategories>>>([])
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(() => localIsoDate())
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)

  const activeMonth = currentMonthKey()
  const activeMonthLabel = formatMonthLabel(activeMonth)
  const { from: monthFrom, to: monthTo } = monthDateRange(activeMonth)

  useEffect(() => {
    void listExpenseCategories().then(setCategories)
  }, [])

  const allExpenses = expensesQuery.state.status === 'success' ? expensesQuery.state.data : []

  const thisMonthExpenses = useMemo(
    () => allExpenses.filter((e) => isDateInMonth(e.expense_date, activeMonth)),
    [allExpenses, activeMonth],
  )

  const thisMonthTotal = useMemo(
    () => thisMonthExpenses.reduce((s, e) => s + Number(e.amount), 0),
    [thisMonthExpenses],
  )

  const monthHistory = useMemo(() => {
    return summarizeByMonth(allExpenses).filter((m) => m.monthKey !== activeMonth)
  }, [allExpenses, activeMonth])

  const expandedMonthRows = useMemo(() => {
    if (!expandedMonth) return []
    return allExpenses.filter((e) => isDateInMonth(e.expense_date, expandedMonth))
  }, [allExpenses, expandedMonth])

  function resetForm() {
    setAmount('')
    setNotes('')
    setExpenseDate(localIsoDate())
    setFormError(null)
  }

  async function handleSave() {
    const value = Number(amount)
    if (!categoryId) throw new Error('Please choose a category.')
    if (!value || value <= 0) throw new Error('Please enter a valid amount.')
    if (!isDateInMonth(expenseDate, activeMonth)) {
      throw new Error(`Date must be in ${activeMonthLabel}.`)
    }
    await saveExpense({
      expense_category_id: categoryId,
      amount: value,
      expense_date: expenseDate,
      description: notes || undefined,
    })
    resetForm()
    await expensesQuery.reload({ silent: true })
  }

  function onSaveClick() {
    setFormError(null)
    void submit.run(handleSave, 'Expense saved')
  }

  return (
    <PageShell title="Expenses" subtitle="Money spent on running the mill">
      <div className="space-y-6">
        <Card className="border-brand-200 bg-brand-50/50">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">This month</p>
          <p className="text-xl font-bold text-brand-900">{activeMonthLabel}</p>
          <p className="mt-2 text-2xl font-bold text-action-expense">{formatCurrency(thisMonthTotal)}</p>
          <p className="text-sm text-slate-600">
            {thisMonthExpenses.length} expense{thisMonthExpenses.length === 1 ? '' : 's'} — resets when a new month
            starts
          </p>
        </Card>

        <Card className="space-y-4">
          <p className="text-sm font-semibold text-brand-900">Record expense</p>
          <Select
            label="Category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Amount (₹)"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Input
              label="Date"
              type="date"
              min={monthFrom}
              max={monthTo}
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
            />
          </div>
          <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {formError ? <Alert variant="error">{formError}</Alert> : null}
          {submit.error ? <Alert variant="error">{submit.error}</Alert> : null}
          {submit.successMessage ? (
            <Alert variant="success" title="Saved">{submit.successMessage}</Alert>
          ) : null}
          <Button
            fullWidth
            size="lg"
            className="bg-action-expense"
            disabled={submit.isSaving}
            onClick={onSaveClick}
          >
            {submit.isSaving ? 'Saving…' : 'Save expense'}
          </Button>
        </Card>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-brand-900">{activeMonthLabel} — details</h2>
          {expensesQuery.state.status === 'loading' && allExpenses.length === 0 ? (
            <PageState status="loading" label="Loading expenses…" />
          ) : null}
          {expensesQuery.state.status === 'error' ? (
            <PageState status="error" message={expensesQuery.state.message} onRetry={expensesQuery.reload} />
          ) : null}
          <HistoryTable
            rows={thisMonthExpenses}
            emptyMessage="No expenses this month yet."
            columns={[
              { key: 'date', header: 'Date', primary: true, render: (r) => formatDate(r.expense_date) },
              { key: 'cat', header: 'Category', render: (r) => r.category?.name ?? '—' },
              { key: 'amount', header: 'Amount', render: (r) => formatCurrency(r.amount) },
              { key: 'notes', header: 'Notes', render: (r) => r.description?.trim() || '—' },
            ]}
          />
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-bold text-brand-900">History</h2>
          <p className="text-sm text-slate-600">Past months saved automatically from your expense records.</p>
          {monthHistory.length === 0 ? (
            <p className="text-sm text-slate-500">No past months yet.</p>
          ) : (
            <div className="space-y-2">
              {monthHistory.map((m) => (
                <Card key={m.monthKey} className="p-0 overflow-hidden">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"
                    onClick={() =>
                      setExpandedMonth((prev) => (prev === m.monthKey ? null : m.monthKey))
                    }
                  >
                    <span className="font-semibold text-brand-900">{m.label}</span>
                    <span className="text-sm text-slate-600">{m.count} items</span>
                    <span className="font-bold text-action-expense">{formatCurrency(m.total)}</span>
                  </button>
                  {expandedMonth === m.monthKey ? (
                    <div className="border-t border-brand-100 px-2 pb-2">
                      <MonthExpenseLines rows={expandedMonthRows} />
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  )
}

function MonthExpenseLines({ rows }: { rows: ExpenseListRow[] }) {
  if (rows.length === 0) {
    return <p className="p-3 text-sm text-slate-500">No lines.</p>
  }
  return (
    <HistoryTable
      rows={rows}
      emptyMessage="No expenses."
      columns={[
        { key: 'date', header: 'Date', primary: true, render: (r) => formatDate(r.expense_date) },
        { key: 'cat', header: 'Category', render: (r) => r.category?.name ?? '—' },
        { key: 'amount', header: 'Amount', render: (r) => formatCurrency(r.amount) },
        { key: 'notes', header: 'Notes', render: (r) => r.description?.trim() || '—' },
      ]}
    />
  )
}
