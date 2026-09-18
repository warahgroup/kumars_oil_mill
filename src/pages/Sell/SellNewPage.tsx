import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageShell } from '@/components/common/PageShell'
import { ConfirmPanel } from '@/components/common/ConfirmPanel'
import { StickyActions } from '@/components/common/StickyActions'
import { formatCurrency } from '@/lib/format'
import { useSubmit } from '@/hooks/useSubmit'
import { accountIdByType, usePaymentAccounts } from '@/hooks/usePaymentAccounts'
import {
  listCustomers,
  listProductPackages,
  listProducts,
  upsertCustomer,
} from '@/services/masterDataService'
import {
  allocateBulkFefo,
  allocatePackagedFefo,
  getPackagedAvailability,
  saveSale,
  type CartLine,
} from '@/services/salesService'
import type { AccountType, Customer, Product, ProductPackage } from '@/types/entities'
import {
  defaultPackageSelection,
  findPackageByG,
  findPackageByMl,
  formatGLabel,
  formatMlLabel,
  isPowderProduct,
  OIL_PACKAGE_SIZES_ML,
  packageSelectionLabel,
  POWDER_PACKAGE_SIZES_G,
  type PackageSelection,
} from '@/pages/Sell/sellNewFormUtils'

type DraftLine = {
  product_id: string
  product_package_id?: string
  quantity: number
  unit_price: number
  priceMode: 'retail' | 'wholesale'
  is_bulk: boolean
  displayLabel: string
}

function nowTimeLabel(): string {
  return new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function chipClass(active: boolean, disabled?: boolean): string {
  const base =
    'min-h-12 rounded-xl border-2 px-3 py-2 text-sm font-bold transition active:scale-[0.98]'
  if (disabled) return `${base} border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed`
  if (active) return `${base} border-accent-400 bg-accent-300/30 text-brand-900 shadow-sm`
  return `${base} border-brand-100 bg-white text-brand-800 hover:border-brand-300`
}

function productCardClass(active: boolean): string {
  const base =
    'flex min-h-[4.5rem] flex-col items-center justify-center rounded-2xl border-2 px-2 py-3 text-center transition active:scale-[0.98]'
  if (active) return `${base} border-accent-400 bg-gradient-to-b from-accent-300/40 to-white shadow-md`
  return `${base} border-brand-100 bg-white hover:border-brand-300`
}

type ToggleProps = {
  value: 'retail' | 'wholesale'
  onChange: (v: 'retail' | 'wholesale') => void
  retailPrice: number
  wholesalePrice: number
}

function PriceTypeToggle({ value, onChange, retailPrice, wholesalePrice }: ToggleProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        className={chipClass(value === 'retail')}
        onClick={() => onChange('retail')}
      >
        <span className="block text-xs font-semibold uppercase text-slate-500">Retail</span>
        <span className="block text-base">{formatCurrency(retailPrice)}</span>
      </button>
      <button
        type="button"
        className={chipClass(value === 'wholesale')}
        onClick={() => onChange('wholesale')}
      >
        <span className="block text-xs font-semibold uppercase text-slate-500">Wholesale</span>
        <span className="block text-base">{formatCurrency(wholesalePrice)}</span>
      </button>
    </div>
  )
}

type PaymentToggleProps = {
  value: AccountType
  onChange: (v: AccountType) => void
}

function PaymentToggle({ value, onChange }: PaymentToggleProps) {
  const options: { id: AccountType; label: string }[] = [
    { id: 'cash', label: 'Cash' },
    { id: 'upi', label: 'UPI' },
    { id: 'bank', label: 'Bank' },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          className={chipClass(value === o.id)}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function QuantityStepper({
  value,
  onChange,
  min = 1,
  step = 1,
  allowDecimal = false,
}: {
  value: string
  onChange: (v: string) => void
  min?: number
  step?: number
  allowDecimal?: boolean
}) {
  const num = Number(value)
  const parsed = Number.isFinite(num) ? num : min

  function bump(delta: number) {
    const next = Math.max(min, parsed + delta)
    onChange(allowDecimal ? String(next) : String(Math.round(next)))
  }

  return (
    <div className="flex items-stretch gap-2">
      <button
        type="button"
        aria-label="Decrease quantity"
        className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 border-brand-200 bg-white text-xl font-bold text-brand-800"
        onClick={() => bump(-step)}
      >
        −
      </button>
      <input
        type="number"
        min={min}
        step={allowDecimal ? 0.001 : 1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-12 w-full rounded-xl border-2 border-brand-100 bg-white px-3 text-center text-lg font-bold text-brand-900 outline-none focus:border-brand-500"
        aria-label="Quantity"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        className="flex min-h-12 min-w-12 items-center justify-center rounded-xl border-2 border-brand-200 bg-white text-xl font-bold text-brand-800"
        onClick={() => bump(step)}
      >
        +
      </button>
    </div>
  )
}

export default function SellNewPage() {
  const navigate = useNavigate()
  const submit = useSubmit()
  const accounts = usePaymentAccounts()
  const [products, setProducts] = useState<Product[]>([])
  const [packages, setPackages] = useState<ProductPackage[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  const [productId, setProductId] = useState('')
  const [packageSelection, setPackageSelection] = useState<PackageSelection>({
    mode: 'packaged_ml',
    sizeMl: 500,
  })
  const [customAmount, setCustomAmount] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [priceMode, setPriceMode] = useState<'retail' | 'wholesale'>('retail')
  const [cart, setCart] = useState<DraftLine[]>([])
  const [bulkCustomerName, setBulkCustomerName] = useState('')
  const [payment, setPayment] = useState<AccountType>('cash')
  const [saleDate, setSaleDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [saleTime] = useState(nowTimeLabel)
  const [showConfirm, setShowConfirm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([listProducts(), listProductPackages(), listCustomers()]).then(([p, pk, c]) => {
      const sellable = p.filter((x) => !x.is_waste)
      setProducts(sellable)
      setPackages(pk)
      setCustomers(c)

      if (sellable.length > 0) {
        const first = sellable[0]
        setProductId(first.id)
        setPackageSelection(defaultPackageSelection(first))
      }
    })
  }, [])

  const product = products.find((p) => p.id === productId)
  const productPackages = packages.filter((p) => p.product_id === productId)

  const unitPrice = product
    ? priceMode === 'retail'
      ? Number(product.retail_price)
      : Number(product.wholesale_price)
    : 0

  const qtyNum = Number(quantity)
  const effectiveQty =
    packageSelection.mode === 'custom_litres'
      ? Number(customAmount) * (Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 0)
      : qtyNum
  const lineTotalPreview =
    product && Number.isFinite(effectiveQty) && effectiveQty > 0 ? effectiveQty * unitPrice : 0

  const cartHasBulk = cart.some((l) => l.is_bulk)
  const showBulkCustomer = cartHasBulk || packageSelection.mode === 'custom_litres'

  function selectProduct(id: string) {
    const p = products.find((x) => x.id === id)
    if (!p) return
    setProductId(id)
    setPackageSelection(defaultPackageSelection(p))
    setCustomAmount('')
    setQuantity('1')
    setFormError(null)
  }

  function resolveLineForCart(): Omit<DraftLine, 'displayLabel'> & { displayLabel: string } | null {
    if (!product) {
      setFormError('Choose a product.')
      return null
    }
    const qty = Number(quantity)
    if (!Number.isFinite(qty) || qty <= 0) {
      setFormError('Enter a valid quantity.')
      return null
    }

    if (product.is_oil) {
      if (packageSelection.mode === 'custom_litres') {
        const litres = Number(customAmount)
        if (!Number.isFinite(litres) || litres <= 0) {
          setFormError('Enter litres for custom bulk sale.')
          return null
        }
        const totalLitres = litres * qty
        return {
          product_id: productId,
          quantity: totalLitres,
          unit_price: unitPrice,
          priceMode,
          is_bulk: true,
          displayLabel:
            qty > 1
              ? `${product.name} · ${litres} L × ${qty} = ${totalLitres} L bulk`
              : `${product.name} · ${totalLitres} L bulk`,
        }
      }
      if (packageSelection.mode === 'packaged_ml') {
        const pkg = findPackageByMl(productPackages, packageSelection.sizeMl)
        if (!pkg) {
          setFormError(
            `${formatMlLabel(packageSelection.sizeMl)} is not set up. Bottle this size first or pick another package.`,
          )
          return null
        }
        return {
          product_id: productId,
          product_package_id: pkg.id,
          quantity: qty,
          unit_price: unitPrice,
          priceMode,
          is_bulk: false,
          displayLabel: `${product.name} · ${pkg.label} × ${qty}`,
        }
      }
    }

    if (isPowderProduct(product)) {
      if (packageSelection.mode === 'custom_grams') {
        const grams = Number(customAmount)
        if (!Number.isFinite(grams) || grams <= 0) {
          setFormError('Enter grams for custom sale.')
          return null
        }
        const pkg = findPackageByG(productPackages, grams)
        if (!pkg) {
          setFormError(
            `No ${grams} g package for this product. Pick a standard size or add packages in Settings.`,
          )
          return null
        }
        return {
          product_id: productId,
          product_package_id: pkg.id,
          quantity: qty,
          unit_price: unitPrice,
          priceMode,
          is_bulk: false,
          displayLabel: `${product.name} · ${pkg.label} × ${qty}`,
        }
      }
      if (packageSelection.mode === 'packaged_g') {
        const pkg = findPackageByG(productPackages, packageSelection.sizeG)
        if (!pkg) {
          setFormError(
            `${formatGLabel(packageSelection.sizeG)} is not set up. Add this package in Settings.`,
          )
          return null
        }
        return {
          product_id: productId,
          product_package_id: pkg.id,
          quantity: qty,
          unit_price: unitPrice,
          priceMode,
          is_bulk: false,
          displayLabel: `${product.name} · ${pkg.label} × ${qty}`,
        }
      }
    }

    setFormError('This product cannot be sold from this screen yet.')
    return null
  }

  function addToCart() {
    setFormError(null)
    const line = resolveLineForCart()
    if (!line) return
    setCart((prev) => [...prev, line])
    setQuantity('1')
    setCustomAmount('')
  }

  function removeFromCart(index: number) {
    setCart((prev) => prev.filter((_, i) => i !== index))
  }

  const subtotal = cart.reduce((s, l) => s + l.quantity * l.unit_price, 0)

  async function resolveBulkCustomerId(): Promise<string | undefined> {
    const hasBulk = cart.some((l) => l.is_bulk)
    if (!hasBulk) return undefined

    const name = bulkCustomerName.trim()
    if (!name) throw new Error('Enter customer name for bulk sale')

    const existing = customers.find((c) => c.name.toLowerCase() === name.toLowerCase())
    if (existing) return existing.id

    const created = await upsertCustomer({ name, customer_type: 'wholesale' })
    setCustomers((prev) => [...prev, created])
    return created.id
  }

  async function handleSave() {
    if (cart.length === 0) throw new Error('Add at least one item')
    if (accounts.state.status !== 'success') throw new Error('Accounts not loaded')
    const accountId = accountIdByType(accounts.state.data, payment)
    if (!accountId) throw new Error('Payment account missing')

    const availability = await getPackagedAvailability()
    const rpcLines: CartLine[] = []

    for (const line of cart) {
      if (line.is_bulk) {
        const allocations = await allocateBulkFefo(line.product_id, line.quantity)
        for (const a of allocations) {
          rpcLines.push({
            product_id: line.product_id,
            production_batch_id: a.production_batch_id,
            quantity: a.quantity,
            unit_price: line.unit_price,
            is_bulk_sale: true,
          })
        }
      } else {
        const allocations = allocatePackagedFefo(availability, line.product_package_id!, line.quantity)
        for (const a of allocations) {
          rpcLines.push({
            product_id: line.product_id,
            product_package_id: line.product_package_id,
            production_batch_id: a.production_batch_id,
            quantity: a.quantity,
            unit_price: line.unit_price,
            is_bulk_sale: false,
          })
        }
      }
    }

    const customer_id = await resolveBulkCustomerId()

    const saleId = await saveSale({
      customer_id,
      sale_date: saleDate,
      financial_account_id: accountId,
      lines: rpcLines,
    })
    navigate(`/bills/${saleId}`)
  }

  const showCustomInput =
    packageSelection.mode === 'custom_litres' || packageSelection.mode === 'custom_grams'

  return (
    <PageShell title="New sale" subtitle="Tap product, package, quantity — then add to cart" backTo="/sell" width="narrow">
      <div className="space-y-4 pb-4">
        {showConfirm ? (
          <ConfirmPanel
            title="Complete this sale?"
            description={`Total: ${formatCurrency(subtotal)} · Payment: ${payment.toUpperCase()}${
              cartHasBulk && bulkCustomerName.trim()
                ? ` · Customer: ${bulkCustomerName.trim()}`
                : ''
            }`}
            confirmLabel="Yes, complete sale"
            onCancel={() => setShowConfirm(false)}
            loading={submit.isSaving}
            onConfirm={() => void submit.run(handleSave, 'Sale completed')}
          />
        ) : null}

        {!showConfirm ? (
          <>
            <Card className="space-y-3" padding="lg">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-600">1 · Product</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={productCardClass(p.id === productId)}
                    onClick={() => selectProduct(p.id)}
                  >
                    <span className="text-sm font-bold leading-tight text-brand-900">{p.name}</span>
                  </button>
                ))}
              </div>
            </Card>

            {product ? (
              <Card className="space-y-3" padding="lg">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-600">2 · Package</p>
                {product.is_oil ? (
                  <div className="flex flex-wrap gap-2">
                    {OIL_PACKAGE_SIZES_ML.map((ml) => {
                      const available = Boolean(findPackageByMl(productPackages, ml))
                      const active =
                        packageSelection.mode === 'packaged_ml' && packageSelection.sizeMl === ml
                      return (
                        <button
                          key={ml}
                          type="button"
                          disabled={!available}
                          className={chipClass(active, !available)}
                          onClick={() => setPackageSelection({ mode: 'packaged_ml', sizeMl: ml })}
                        >
                          {formatMlLabel(ml)}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      className={chipClass(packageSelection.mode === 'custom_litres')}
                      onClick={() => setPackageSelection({ mode: 'custom_litres' })}
                    >
                      Custom litres
                    </button>
                  </div>
                ) : isPowderProduct(product) ? (
                  <div className="flex flex-wrap gap-2">
                    {POWDER_PACKAGE_SIZES_G.map((g) => {
                      const available = Boolean(findPackageByG(productPackages, g))
                      const active =
                        packageSelection.mode === 'packaged_g' && packageSelection.sizeG === g
                      return (
                        <button
                          key={g}
                          type="button"
                          disabled={!available}
                          className={chipClass(active, !available)}
                          onClick={() => setPackageSelection({ mode: 'packaged_g', sizeG: g })}
                        >
                          {formatGLabel(g)}
                        </button>
                      )
                    })}
                    <button
                      type="button"
                      className={chipClass(packageSelection.mode === 'custom_grams')}
                      onClick={() => setPackageSelection({ mode: 'custom_grams' })}
                    >
                      Custom grams
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">Use standard packages from stock for this product.</p>
                )}
                {showCustomInput ? (
                  <Input
                    label={packageSelection.mode === 'custom_litres' ? 'Litres' : 'Grams (total weight)'}
                    type="number"
                    min="0.001"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    placeholder={packageSelection.mode === 'custom_litres' ? 'e.g. 2.5' : 'e.g. 750'}
                  />
                ) : (
                  <p className="text-sm text-slate-500">
                    Selected:{' '}
                    <span className="font-semibold text-brand-800">
                      {packageSelectionLabel(packageSelection, productPackages)}
                    </span>
                  </p>
                )}
              </Card>
            ) : null}

            {product ? (
              <Card className="space-y-4" padding="lg">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-600">3 · Quantity & price</p>
                {packageSelection.mode !== 'custom_litres' ? (
                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">Quantity</p>
                    <QuantityStepper value={quantity} onChange={setQuantity} min={1} step={1} />
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Litres are set above. Use quantity as a multiplier if selling the same amount more
                    than once.
                  </p>
                )}
                {packageSelection.mode === 'custom_litres' ? (
                  <div>
                    <p className="mb-2 text-sm font-medium text-slate-700">Multiplier</p>
                    <QuantityStepper value={quantity} onChange={setQuantity} min={1} step={1} />
                  </div>
                ) : null}
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-700">Price type</p>
                  <PriceTypeToggle
                    value={priceMode}
                    onChange={setPriceMode}
                    retailPrice={Number(product.retail_price)}
                    wholesalePrice={Number(product.wholesale_price)}
                  />
                </div>
                <div className="rounded-xl border-2 border-brand-100 bg-brand-50/80 px-4 py-3 text-center">
                  <p className="text-xs font-semibold uppercase text-slate-500">Line total</p>
                  <p className="text-2xl font-bold text-brand-900">{formatCurrency(lineTotalPreview)}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {effectiveQty > 0
                      ? `${effectiveQty} × ${formatCurrency(unitPrice)}`
                      : '—'}
                  </p>
                </div>
                {formError ? <Alert variant="error">{formError}</Alert> : null}
                <Button type="button" variant="secondary" fullWidth size="lg" onClick={addToCart}>
                  Add to cart
                </Button>
              </Card>
            ) : null}

            <Card padding="lg" className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wide text-brand-600">Cart</h2>
                <span className="text-xs text-slate-500">{cart.length} item(s)</span>
              </div>
              {cart.length === 0 ? (
                <p className="text-sm text-slate-500">No items yet. Add products above.</p>
              ) : (
                <ul className="space-y-3">
                  {cart.map((l, i) => (
                    <li
                      key={`${l.product_id}-${i}`}
                      className="flex gap-2 rounded-xl border border-brand-100 bg-white p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-brand-900">{l.displayLabel}</p>
                        <p className="text-xs text-slate-500">
                          {l.priceMode === 'retail' ? 'Retail' : 'Wholesale'} ·{' '}
                          {formatCurrency(l.unit_price)} each
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-brand-900">
                          {formatCurrency(l.quantity * l.unit_price)}
                        </p>
                        <button
                          type="button"
                          className="mt-1 text-xs font-bold text-red-600"
                          onClick={() => removeFromCart(i)}
                        >
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="rounded-2xl border-2 border-accent-400/50 bg-gradient-to-r from-accent-300/25 to-white px-4 py-4 text-center">
                <p className="text-xs font-bold uppercase text-brand-700">Grand total</p>
                <p className="text-3xl font-bold text-brand-900">{formatCurrency(subtotal)}</p>
              </div>
            </Card>

            {showBulkCustomer ? (
              <Card className="space-y-3" padding="lg">
                <p className="text-xs font-bold uppercase tracking-wide text-brand-600">Bulk customer</p>
                <p className="text-sm text-slate-600">
                  Retail walk-in sales do not need a customer. Bulk oil sales require a name.
                </p>
                <Input
                  label="Customer name"
                  value={bulkCustomerName}
                  onChange={(e) => setBulkCustomerName(e.target.value)}
                  placeholder="e.g. Anand Stores"
                  autoComplete="name"
                />
                {customers.filter((c) => !c.name.toLowerCase().includes('walk-in')).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {customers
                      .filter((c) => !c.name.toLowerCase().includes('walk-in'))
                      .slice(0, 6)
                      .map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className={chipClass(bulkCustomerName === c.name)}
                          onClick={() => setBulkCustomerName(c.name)}
                        >
                          {c.name}
                        </button>
                      ))}
                  </div>
                ) : null}
              </Card>
            ) : null}

            <Card className="space-y-4" padding="lg">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-600">Sale date</p>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Date"
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                />
                <div>
                  <p className="mb-1 text-sm font-medium text-slate-700">Time</p>
                  <p className="flex min-h-12 items-center rounded-xl border-2 border-brand-100 bg-slate-50 px-3 text-sm font-semibold text-slate-600">
                    {saleTime}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="space-y-3" padding="lg">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-600">Payment method</p>
              <PaymentToggle value={payment} onChange={setPayment} />
              {submit.error ? <Alert variant="error">{submit.error}</Alert> : null}
            </Card>

            <StickyActions>
              <Button
                fullWidth
                size="lg"
                className="bg-action-sales"
                disabled={
                  submit.isSaving ||
                  cart.length === 0 ||
                  (cartHasBulk && !bulkCustomerName.trim())
                }
                onClick={() => {
                  if (cartHasBulk && !bulkCustomerName.trim()) {
                    setFormError('Enter customer name for bulk sale')
                    return
                  }
                  setShowConfirm(true)
                }}
              >
                Review & complete sale
              </Button>
            </StickyActions>
          </>
        ) : null}
      </div>
    </PageShell>
  )
}
