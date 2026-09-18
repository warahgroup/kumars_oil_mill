import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ConfirmPanel } from '@/components/common/ConfirmPanel'
import { PageShell } from '@/components/common/PageShell'
import { StickyActions } from '@/components/common/StickyActions'
import { CalculationPanel } from '@/components/common/CalculationPanel'
import { formatCurrency } from '@/lib/format'
import { useSubmit } from '@/hooks/useSubmit'
import { accountIdByType, usePaymentAccounts } from '@/hooks/usePaymentAccounts'
import { listExpenseCategories } from '@/services/masterDataService'
import { saveExpense } from '@/services/expenseService'
import type { AccountType } from '@/types/entities'

export default function ExpenseNewPage() {
  const navigate = useNavigate()
  const submit = useSubmit()
  const accounts = usePaymentAccounts()
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof listExpenseCategories>>>([])
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [payment, setPayment] = useState<AccountType>('cash')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    void listExpenseCategories().then(setCategories)
  }, [])

  async function handleSave() {
    const value = Number(amount)
    if (!categoryId) throw new Error('Please choose a category.')
    if (!value || value <= 0) throw new Error('Please enter a valid amount.')
    if (accounts.state.status !== 'success') throw new Error('Please wait — loading payment methods.')
    const accountId = accountIdByType(accounts.state.data, payment)
    if (!accountId) throw new Error('Please select a payment method.')
    await saveExpense({
      expense_category_id: categoryId,
      amount: value,
      financial_account_id: accountId,
      expense_date: date,
      description: notes || undefined,
    })
    navigate('/expense')
  }

  const value = Number(amount)

  return (
    <PageShell title="New expense" subtitle="Record money spent" backTo="/expense" width="narrow">
      {showConfirm ? (
        <ConfirmPanel
          title="Save this expense?"
          description={`${formatCurrency(value)} from ${payment}`}
          confirmLabel="Yes, save expense"
          onCancel={() => setShowConfirm(false)}
          loading={submit.isSaving}
          onConfirm={() => void submit.run(handleSave, 'Expense saved')}
        />
      ) : (
        <Card className="space-y-4">
          <Select label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
          <Input label="Amount (₹)" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Select label="Payment method" value={payment} onChange={(e) => setPayment(e.target.value as AccountType)} options={[{ value: 'cash', label: 'Cash' }, { value: 'upi', label: 'UPI' }, { value: 'bank', label: 'Bank' }]} />
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Textarea label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
          {value > 0 ? (
            <CalculationPanel lines={[{ label: 'You will record', value: formatCurrency(value), emphasis: true }]} />
          ) : null}
          {submit.error ? <Alert variant="error">{submit.error}</Alert> : null}
        </Card>
      )}
      {!showConfirm ? (
        <StickyActions>
          <Button fullWidth size="lg" className="bg-action-expense" onClick={() => setShowConfirm(true)}>
            Review & save
          </Button>
        </StickyActions>
      ) : null}
    </PageShell>
  )
}
