import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { formatMlLabel } from '@/pages/Sell/sellNewFormUtils'
import {
  allBottleSizesMl,
  loadExtraBottleSizesMl,
  parseCustomBottleSizeInput,
  saveExtraBottleSizesMl,
  DEFAULT_BOTTLE_SIZES_ML,
} from '@/lib/bottlePurchaseSizes'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { HistoryTable } from '@/components/common/HistoryTable'
import { PageShell } from '@/components/common/PageShell'
import { PageState } from '@/components/common/PageState'
import { PeriodFilterChips } from '@/components/common/PeriodFilter'
import { ConfirmPanel } from '@/components/common/ConfirmPanel'
import { formatCurrency, formatDate } from '@/lib/format'
import { toFriendlyError } from '@/lib/friendlyErrors'
import { isDateInRange, localIsoDate, periodDateRange, type PeriodFilter } from '@/lib/dateRangeFilter'
import {
  filterMaterialsByCategory,
  purchaseCategoryLabel,
  type PurchaseCategory,
} from '@/lib/purchaseCategory'
import { useQuery } from '@/hooks/useQuery'
import { useSubmit } from '@/hooks/useSubmit'
import { accountIdByType, usePaymentAccounts } from '@/hooks/usePaymentAccounts'
import { createRawMaterial, getOrCreateBottleRawMaterial, listRawMaterials } from '@/services/masterDataService'
import {
  listPurchases,
  purchaseMatchesCategory,
  savePurchase,
  supplierLabelFromNotes,
  type PurchaseListRow,
} from '@/services/purchaseService'
import { getMonthlyWeightedAverage } from '@/services/stockService'
import type { RawMaterial } from '@/types/entities'

function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function chipClass(active: boolean): string {
  const base =
    'min-h-11 rounded-xl border-2 px-3 py-2 text-sm font-bold transition active:scale-[0.98]'
  if (active) return `${base} border-accent-400 bg-accent-300/30 text-brand-900 shadow-sm`
  return `${base} border-brand-100 bg-white text-brand-800 hover:border-brand-300`
}

function materialChipClass(active: boolean): string {
  const base =
    'flex min-h-[3.25rem] flex-col items-center justify-center rounded-xl border-2 px-2 py-2 text-center text-sm font-semibold transition active:scale-[0.98]'
  if (active) return `${base} border-accent-400 bg-accent-300/25 text-brand-900`
  return `${base} border-brand-100 bg-white text-brand-800 hover:border-brand-300`
}

function historySummary(row: PurchaseListRow): string {
  const lines = row.batches ?? []
  if (lines.length === 0) return '—'
  return lines
    .map((b) => {
      const name = b.material?.name ?? 'Material'
      const unit = b.material?.unit ?? ''
      return `${b.quantity} ${unit} ${name}`.trim()
    })
    .join(', ')
}

const CATEGORY_TABS: PurchaseCategory[] = ['raw', 'bottle', 'package']

export default function BuyPage() {
  const submit = useSubmit()
  const accounts = usePaymentAccounts()
  const purchasesQuery = useQuery(() => listPurchases(), [])
  const [searchParams] = useSearchParams()

  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [materialsError, setMaterialsError] = useState<string | null>(null)
  const [period, setPeriod] = useState<PeriodFilter>('month')
  const [category, setCategory] = useState<PurchaseCategory>('raw')
  const [bottleSizeMl, setBottleSizeMl] = useState<number>(500)
  const [extraBottleSizes, setExtraBottleSizes] = useState<number[]>(() => loadExtraBottleSizesMl())
  const [customBottleSizeInput, setCustomBottleSizeInput] = useState('')
  const [resolvingBottle, setResolvingBottle] = useState(false)

  const [rawMaterialId, setRawMaterialId] = useState('')
  const [supplierName, setSupplierName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(() => localIsoDate())
  const [expiryDate, setExpiryDate] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [weightedAvg, setWeightedAvg] = useState<number | null>(null)

  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [newItemDesc, setNewItemDesc] = useState('')
  const [addingItem, setAddingItem] = useState(false)

  useEffect(() => {
    const cat = searchParams.get('cat')
    if (cat === 'bottle' || cat === 'package' || cat === 'raw') {
      setCategory(cat)
    }
  }, [searchParams])

  useEffect(() => {
    void listRawMaterials()
      .then(setMaterials)
      .catch((e) => setMaterialsError(e instanceof Error ? e.message : 'Failed to load materials'))
  }, [])

  const bottleSizes = useMemo(() => allBottleSizesMl(extraBottleSizes), [extraBottleSizes])

  useEffect(() => {
    if (category !== 'bottle') return
    setResolvingBottle(true)
    void getOrCreateBottleRawMaterial(bottleSizeMl)
      .then((m) => {
        setRawMaterialId(m.id)
        setMaterials((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev
          return [...prev, m].sort((a, b) => a.name.localeCompare(b.name))
        })
      })
      .catch((e) => setMaterialsError(e instanceof Error ? e.message : 'Failed to load bottle size'))
      .finally(() => setResolvingBottle(false))
  }, [category, bottleSizeMl])

  const categoryMaterials = useMemo(
    () => filterMaterialsByCategory(materials, category),
    [materials, category],
  )

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
    if (category === 'bottle' || !rawMaterialId || !purchaseDate) return
    const d = new Date(purchaseDate)
    void getMonthlyWeightedAverage(rawMaterialId, d.getFullYear(), d.getMonth() + 1).then(setWeightedAvg)
  }, [rawMaterialId, purchaseDate, category])

  useEffect(() => {
    if (category === 'bottle') return
    if (rawMaterialId && !categoryMaterials.some((m) => m.id === rawMaterialId)) {
      setRawMaterialId('')
    }
  }, [categoryMaterials, rawMaterialId, category])

  const { from, to } = periodDateRange(period)

  const filteredHistory = useMemo(() => {
    if (purchasesQuery.state.status !== 'success') return []
    return purchasesQuery.state.data.filter(
      (row) =>
        isDateInRange(row.transaction_date, from, to) && purchaseMatchesCategory(row, category, materials),
    )
  }, [purchasesQuery.state, from, to, category, materials])

  function resetForm(keepMaterial?: boolean) {
    if (!keepMaterial) setRawMaterialId('')
    setSupplierName('')
    setQuantity('')
    setTotalAmount('')
    setExpiryDate('')
    setPurchaseDate(localIsoDate())
    setShowConfirm(false)
    setFormError(null)
  }

  function validate() {
    if (category === 'bottle') {
      if (!bottleSizeMl) throw new Error('Please choose a bottle size.')
      if (resolvingBottle || !rawMaterialId) throw new Error('Please wait — loading bottle size.')
    } else if (!rawMaterialId) {
      throw new Error('Please choose an item.')
    }
    if (!qty || qty <= 0) throw new Error(category === 'bottle' ? 'Please enter count.' : 'Please enter quantity.')
    if (!total || total <= 0) throw new Error('Please enter total paid.')
    if (accounts.state.status !== 'success') throw new Error('Please wait — loading accounts.')
    const accountId = accountIdByType(accounts.state.data, 'cash')
    if (!accountId) throw new Error('Cash account not found.')
    return accountId
  }

  async function handleSave() {
    const accountId = validate()
    await savePurchase({
      raw_material_id: rawMaterialId,
      supplier_name: supplierName || undefined,
      quantity: qty,
      total_amount: total,
      transaction_date: purchaseDate,
      expiry_date: computedExpiry || undefined,
      financial_account_id: accountId,
    })
    resetForm(true)
    await purchasesQuery.reload({ silent: true })
  }

  function onReview() {
    try {
      validate()
      setFormError(null)
      setShowConfirm(true)
    } catch (e) {
      setFormError(toFriendlyError(e instanceof Error ? e.message : 'Please check the form.'))
    }
  }

  function handleAddCustomBottleSize() {
    const ml = parseCustomBottleSizeInput(customBottleSizeInput)
    if (!ml) {
      setFormError('Enter a size like 750 ml, 1.5 L, or 1000.')
      return
    }
    setFormError(null)
    const defaultSet = new Set<number>(DEFAULT_BOTTLE_SIZES_ML)
    const extraOnly = [...new Set([...extraBottleSizes, ml])].filter((n) => !defaultSet.has(n))
    setExtraBottleSizes(extraOnly)
    saveExtraBottleSizesMl(extraOnly)
    setBottleSizeMl(ml)
    setCustomBottleSizeInput('')
  }

  async function handleAddCustomItem() {
    const price = Number(newItemPrice)
    if (!newItemName.trim()) {
      setFormError('Enter a name for the new item.')
      return
    }
    setAddingItem(true)
    setFormError(null)
    try {
      const created = await createRawMaterial({
        name: newItemName.trim(),
        default_price: Number.isFinite(price) ? price : 0,
        category,
        description: newItemDesc.trim() || undefined,
      })
      setMaterials((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setRawMaterialId(created.id)
      if (price > 0 && !totalAmount) setTotalAmount(String(price))
      setNewItemName('')
      setNewItemPrice('')
      setNewItemDesc('')
    } catch (e) {
      setFormError(toFriendlyError(e instanceof Error ? e.message : 'Could not add item.'))
    } finally {
      setAddingItem(false)
    }
  }

  const summaryLine =
    category === 'bottle' && qty && total
      ? `${qty} × ${formatMlLabel(bottleSizeMl)} bottles · ${formatCurrency(total)}`
      : material && qty && total
        ? `${qty} ${material.unit} ${material.name} · ${formatCurrency(total)}`
        : ''

  const unitPriceLabel =
    category === 'bottle'
      ? 'Per bottle'
      : material?.unit === 'kg'
        ? 'Per kg price'
        : `Per ${material?.unit ?? 'unit'} price`

  return (
    <PageShell title="Purchase" subtitle="Materials you bought">
      <div className="space-y-6">
        <div className="flex flex-wrap gap-2">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={chipClass(category === tab)}
              onClick={() => setCategory(tab)}
            >
              {purchaseCategoryLabel(tab)}
            </button>
          ))}
        </div>

        {materialsError ? <Alert variant="error">{materialsError}</Alert> : null}

        {category === 'bottle' ? (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-brand-900">Bottle size</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {bottleSizes.map((ml) => (
                <button
                  key={ml}
                  type="button"
                  className={chipClass(bottleSizeMl === ml)}
                  onClick={() => setBottleSizeMl(ml)}
                >
                  {formatMlLabel(ml)}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Input
                  label="Add custom size"
                  placeholder="e.g. 750 ml or 1.5 L"
                  value={customBottleSizeInput}
                  onChange={(e) => setCustomBottleSizeInput(e.target.value)}
                />
              </div>
              <Button type="button" variant="secondary" onClick={handleAddCustomBottleSize}>
                Add size
              </Button>
            </div>
          </div>
        ) : categoryMaterials.length > 0 ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categoryMaterials.map((m) => (
              <button
                key={m.id}
                type="button"
                className={materialChipClass(rawMaterialId === m.id)}
                onClick={() => {
                  setRawMaterialId(m.id)
                  if (!totalAmount && m.default_price > 0) {
                    setTotalAmount(String(m.default_price))
                  }
                }}
              >
                <span className="line-clamp-2">{m.name}</span>
                <span className="text-xs font-normal text-slate-500">{m.unit}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-600">No items yet. Add one below.</p>
        )}

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
            <p className="text-sm font-semibold text-brand-900">Record purchase</p>
            <Input
              label="From (optional)"
              placeholder="Type supplier or shop name"
              value={supplierName}
              onChange={(e) => setSupplierName(e.target.value)}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label={category === 'bottle' ? 'Count (bottles)' : 'Quantity'}
                type="number"
                min="0"
                step={category === 'bottle' ? '1' : '0.001'}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <Input
                label="Total paid (₹)"
                type="number"
                min="0"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
              />
            </div>
            {unitCost > 0 && (category === 'bottle' || material) ? (
              <div className="rounded-xl border border-brand-100 bg-brand-50/80 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{unitPriceLabel}</p>
                <p className="text-lg font-bold text-brand-900">
                  {formatCurrency(unitCost)}
                  {category === 'bottle' ? (
                    <span className="text-sm font-semibold text-slate-600"> · {formatMlLabel(bottleSizeMl)}</span>
                  ) : material ? (
                    <span className="text-sm font-semibold text-slate-600"> / {material.unit}</span>
                  ) : null}
                </p>
                {category !== 'bottle' && weightedAvg != null && material ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Avg this month: {formatCurrency(weightedAvg)}/{material.unit}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className={category === 'bottle' ? '' : 'grid gap-4 sm:grid-cols-2'}>
              <Input
                label="Purchase date"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
              {category !== 'bottle' ? (
                <Input
                  label="Expiry (only if different)"
                  type="date"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                />
              ) : null}
            </div>
            {formError ? <Alert variant="error">{formError}</Alert> : null}
            {submit.error ? <Alert variant="error">{submit.error}</Alert> : null}
            {submit.successMessage ? (
              <Alert variant="success" title="Purchase saved">{submit.successMessage}</Alert>
            ) : null}
            <Button
              fullWidth
              size="lg"
              className="bg-action-purchase text-brand-900"
              disabled={submit.isSaving}
              onClick={onReview}
            >
              Review & save
            </Button>
          </Card>
        )}

        {category === 'bottle' ? null : (
        <Card className="space-y-3 border-dashed">
          <p className="text-sm font-semibold text-brand-900">
            Add custom {purchaseCategoryLabel(category).toLowerCase()}
          </p>
          <Input
            label="Name"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
          />
          <Input
            label="Default price (₹, optional)"
            type="number"
            min="0"
            step="0.01"
            value={newItemPrice}
            onChange={(e) => setNewItemPrice(e.target.value)}
          />
          <Input
            label="Description (optional)"
            value={newItemDesc}
            onChange={(e) => setNewItemDesc(e.target.value)}
          />
          <Button
            type="button"
            variant="secondary"
            disabled={addingItem}
            onClick={() => void handleAddCustomItem()}
          >
            {addingItem ? 'Adding…' : 'Add item'}
          </Button>
        </Card>
        )}

        <section className="space-y-3">
          <h2 className="text-base font-bold text-brand-900">History</h2>
          <PeriodFilterChips value={period} onChange={setPeriod} />
          {purchasesQuery.state.status === 'loading' ? (
            <PageState status="loading" label="Loading purchases…" />
          ) : null}
          {purchasesQuery.state.status === 'error' ? (
            <PageState
              status="error"
              message={purchasesQuery.state.message}
              onRetry={purchasesQuery.reload}
            />
          ) : null}
          {purchasesQuery.state.status === 'success' ? (
            <HistoryTable
              rows={filteredHistory}
              emptyMessage="No purchases in this period."
              columns={[
                {
                  key: 'date',
                  header: 'Date',
                  primary: true,
                  render: (r) => formatDate(r.transaction_date),
                },
                {
                  key: 'item',
                  header: 'Item',
                  render: (r) => historySummary(r),
                },
                {
                  key: 'from',
                  header: 'From',
                  render: (r) => supplierLabelFromNotes(r.notes) || '—',
                },
                {
                  key: 'amount',
                  header: 'Amount',
                  render: (r) => formatCurrency(r.total_amount),
                },
              ]}
            />
          ) : null}
        </section>
      </div>
    </PageShell>
  )
}
