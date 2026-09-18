import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { CalculationPanel } from '@/components/common/CalculationPanel'
import { ConfirmPanel } from '@/components/common/ConfirmPanel'
import { PageShell } from '@/components/common/PageShell'
import { StickyActions } from '@/components/common/StickyActions'
import { formatCurrency } from '@/lib/format'
import { toFriendlyError } from '@/lib/friendlyErrors'
import { useSubmit } from '@/hooks/useSubmit'
import { accountIdByType, usePaymentAccounts } from '@/hooks/usePaymentAccounts'
import { createSupplier, listRawMaterials, listSuppliers } from '@/services/masterDataService'
import { savePurchase } from '@/services/purchaseService'
import { getMonthlyWeightedAverage } from '@/services/stockService'
import type { AccountType } from '@/types/entities'

function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function BuyNewPage() {
  const navigate = useNavigate()
  const submit = useSubmit()
  const accounts = usePaymentAccounts()
  const [materials, setMaterials] = useState<Awaited<ReturnType<typeof listRawMaterials>>>([])
  const [suppliers, setSuppliers] = useState<Awaited<ReturnType<typeof listSuppliers>>>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [rawMaterialId, setRawMaterialId] = useState('')
  const [supplierId, setSupplierId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10))
  const [expiryDate, setExpiryDate] = useState('')
  const [payment, setPayment] = useState<AccountType>('cash')
  const [newSupplierName, setNewSupplierName] = useState('')
  const [weightedAvg, setWeightedAvg] = useState<number | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [m, s] = await Promise.all([listRawMaterials(), listSuppliers()])
        setMaterials(m)
        setSuppliers(s)
      } catch (e) {
        setLoadError(e instanceof Error ? e.message : 'Failed to load')
      }
    })()
  }, [])

  const material = materials.find((m) => m.id === rawMaterialId)
  const qty = Number(quantity)
  const total = Number(totalAmount)
  const unitCost = qty > 0 && total > 0 ? total / qty : 0

  const computedExpiry = useMemo(() => {
    if (expiryDate) return expiryDate
    if (!material || !purchaseDate) return ''
    return addDays(purchaseDate, material.shelf_life_days)
  }, [expiryDate, material, purchaseDate])

  useEffect(() => {
    if (!rawMaterialId || !purchaseDate) return
    const d = new Date(purchaseDate)
    void getMonthlyWeightedAverage(rawMaterialId, d.getFullYear(), d.getMonth() + 1).then(setWeightedAvg)
  }, [rawMaterialId, purchaseDate])

  async function handleAddSupplier() {
    if (!newSupplierName.trim()) return
    const s = await createSupplier(newSupplierName.trim())
    setSuppliers((prev) => [...prev, s])
    setSupplierId(s.id)
    setNewSupplierName('')
  }

  function validate() {
    if (!rawMaterialId) throw new Error('Please choose a raw material.')
    if (!qty || qty <= 0) throw new Error('Please enter quantity.')
    if (!total || total <= 0) throw new Error('Please enter total amount.')
    if (accounts.state.status !== 'success') throw new Error('Please wait — loading payment methods.')
    const accountId = accountIdByType(accounts.state.data, payment)
    if (!accountId) throw new Error('Please select a payment method.')
    return accountId
  }

  async function handleSave() {
    const accountId = validate()
    await savePurchase({
      raw_material_id: rawMaterialId,
      supplier_id: supplierId || undefined,
      quantity: qty,
      total_amount: total,
      transaction_date: purchaseDate,
      expiry_date: computedExpiry || undefined,
      financial_account_id: accountId,
    })
    navigate('/buy')
  }

  function onReview() {
    try {
      validate()
      setFormError(null)
      setShowConfirm(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Please check the form.'
      setFormError(toFriendlyError(msg))
    }
  }

  if (loadError) {
    return (
      <PageShell title="New purchase" backTo="/buy">
        <Alert variant="error">{loadError}</Alert>
      </PageShell>
    )
  }

  const summaryLine =
    material && qty && total
      ? `${qty} ${material.unit} ${material.name} · ${formatCurrency(total)} purchase`
      : ''

  return (
    <PageShell title="New purchase" subtitle="Record material you bought" backTo="/buy" width="narrow">
      {showConfirm ? (
        <ConfirmPanel
          title="Save this purchase?"
          description={summaryLine}
          confirmLabel="Yes, save purchase"
          onCancel={() => setShowConfirm(false)}
          loading={submit.isSaving}
          onConfirm={() => void submit.run(handleSave, 'Purchase saved')}
        />
      ) : (
        <Card className="space-y-4">
          <Select
            label="Raw material"
            value={rawMaterialId}
            onChange={(e) => setRawMaterialId(e.target.value)}
            options={materials.map((m) => ({ value: m.id, label: `${m.name} (${m.unit})` }))}
          />
          <Select
            label="Supplier (optional)"
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input label="New supplier name" value={newSupplierName} onChange={(e) => setNewSupplierName(e.target.value)} />
            </div>
            <Button type="button" variant="secondary" onClick={() => void handleAddSupplier()}>Add</Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Quantity" type="number" min="0" step="0.001" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            <Input label="Total paid (₹)" type="number" min="0" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Purchase date" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            <Input label="Expiry (only if different)" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
          <Select
            label="Payment method"
            value={payment}
            onChange={(e) => setPayment(e.target.value as AccountType)}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'upi', label: 'UPI' },
              { value: 'bank', label: 'Bank' },
            ]}
          />

          {unitCost > 0 && material ? (
            <CalculationPanel
              title="Calculated for you"
              lines={[
                { label: 'Summary', value: summaryLine },
                { label: 'Unit cost', value: `${formatCurrency(unitCost)}/${material.unit}`, emphasis: true },
                { label: 'Expiry date', value: computedExpiry || '—' },
                { label: 'Batch ID', value: 'Created when you save' },
                {
                  label: 'Avg cost this month',
                  value: weightedAvg != null ? `${formatCurrency(weightedAvg)}/${material.unit}` : '—',
                },
              ]}
            />
          ) : null}

          {formError ? <Alert variant="error">{formError}</Alert> : null}
          {submit.error ? <Alert variant="error">{submit.error}</Alert> : null}
          {submit.successMessage ? <Alert variant="success" title="Purchase saved">{submit.successMessage}</Alert> : null}
        </Card>
      )}

      {!showConfirm ? (
        <StickyActions>
          <Button fullWidth size="lg" className="bg-action-purchase text-brand-900" disabled={submit.isSaving} onClick={onReview}>
            Review & save
          </Button>
        </StickyActions>
      ) : null}
    </PageShell>
  )
}
