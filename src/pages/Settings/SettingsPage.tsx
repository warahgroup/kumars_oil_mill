import { useEffect, useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Tabs } from '@/components/ui/Tabs'
import { PageShell } from '@/components/common/PageShell'
import { useSubmit } from '@/hooks/useSubmit'
import {
  clearAllBusinessData,
  getDemoDataStatus,
  loadSevenDayDemoData,
  validateBusinessData,
  type BusinessValidation,
} from '@/services/demoDataService'
import { ConfirmPanel } from '@/components/common/ConfirmPanel'
import {
  getBusinessSettings,
  listExpenseCategories,
  listProductPackages,
  listProducts,
  listRawMaterials,
  listRecipes,
  updateBusinessSettings,
  updateProduct,
  updateProductPackage,
  updateRawMaterial,
  updateRecipe,
} from '@/services/masterDataService'
import { seedDefaultBusinessData } from '@/services/onboardingService'

const sections = [
  { id: 'business', label: 'Business' },
  { id: 'products', label: 'Products' },
  { id: 'materials', label: 'Raw Materials' },
  { id: 'packages', label: 'Packages' },
  { id: 'recipes', label: 'Recipes' },
  { id: 'categories', label: 'Expense Categories' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'data', label: 'Data Tools' },
]

export default function SettingsPage() {
  const submit = useSubmit()
  const [active, setActive] = useState('business')
  const [demoLoaded, setDemoLoaded] = useState(false)
  const [demoLoadedAt, setDemoLoadedAt] = useState<string | null>(null)
  const [validation, setValidation] = useState<BusinessValidation | null>(null)
  const [clearPhrase, setClearPhrase] = useState('')
  const [clearStep, setClearStep] = useState<'idle' | 'phrase' | 'confirm'>('idle')
  const [businessName, setBusinessName] = useState('')
  const [alertDays, setAlertDays] = useState('30,15,7')
  const [products, setProducts] = useState<Awaited<ReturnType<typeof listProducts>>>([])
  const [materials, setMaterials] = useState<Awaited<ReturnType<typeof listRawMaterials>>>([])
  const [packages, setPackages] = useState<Awaited<ReturnType<typeof listProductPackages>>>([])
  const [recipes, setRecipes] = useState<Awaited<ReturnType<typeof listRecipes>>>([])
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof listExpenseCategories>>>([])
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const [settings, p, m, pk, r, c] = await Promise.all([
        getBusinessSettings(),
        listProducts(),
        listRawMaterials(),
        listProductPackages(),
        listRecipes(),
        listExpenseCategories(),
      ])
      setBusinessName(settings?.business_name ?? '')
      setAlertDays((settings?.expiry_alert_days as number[] | undefined)?.join(',') ?? '30,15,7')
      setProducts(p)
      setMaterials(m)
      setPackages(pk)
      setRecipes(r)
      setCategories(c)
      const demo = await getDemoDataStatus()
      setDemoLoaded(demo.loaded)
      setDemoLoadedAt(demo.loadedAt)
    })()
  }, [])

  async function saveBusiness() {
    const days = alertDays
      .split(',')
      .map((d) => Number(d.trim()))
      .filter((d) => !Number.isNaN(d) && d > 0)
    await updateBusinessSettings({ business_name: businessName, expiry_alert_days: days })
    setMessage('Business settings saved')
  }

  async function reseed() {
    await seedDefaultBusinessData()
    setMessage('Default data seed completed (skips if already present)')
  }

  async function loadDemo() {
    const result = await loadSevenDayDemoData()
    setValidation(result)
    setDemoLoaded(true)
    setDemoLoadedAt(new Date().toISOString())
    setMessage('7-day demo data loaded. Validation summary is shown below.')
  }

  async function runValidation() {
    const result = await validateBusinessData()
    setValidation(result)
    setMessage('Validation complete')
  }

  async function executeClear() {
    await clearAllBusinessData('raghul')
    setDemoLoaded(false)
    setDemoLoadedAt(null)
    setValidation(null)
    setClearPhrase('')
    setClearStep('idle')
    setMessage('All business transactions cleared for your account.')
  }

  return (
    <PageShell title="Settings" subtitle="Your business details and prices">
    <div>
      <Tabs tabs={sections} active={active} onChange={setActive} />
      {message ? <Alert variant="success">{message}</Alert> : null}
      {submit.error ? <Alert variant="error">{submit.error}</Alert> : null}

      {active === 'business' && (
        <Card className="max-w-lg space-y-3">
          <Input label="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
          <Input label="Expiry alert days (comma separated)" value={alertDays} onChange={(e) => setAlertDays(e.target.value)} />
          <Button onClick={() => void submit.run(saveBusiness, 'Saved')}>Save business</Button>
        </Card>
      )}

      {active === 'products' && (
        <div className="space-y-3">
          {products.map((p) => (
            <Card key={p.id} className="grid gap-2 md:grid-cols-3">
              <Input label="Name" value={p.name} onChange={(e) => setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, name: e.target.value } : x))} />
              <Input label="Retail" type="number" value={p.retail_price} onChange={(e) => setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, retail_price: Number(e.target.value) } : x))} />
              <Button className="self-end" onClick={() => void updateProduct(p.id, { name: p.name, retail_price: p.retail_price, wholesale_price: p.wholesale_price })}>Save</Button>
            </Card>
          ))}
        </div>
      )}

      {active === 'materials' && (
        <div className="space-y-3">
          {materials.map((m) => (
            <Card key={m.id} className="grid gap-2 md:grid-cols-4">
              <Input label="Name" value={m.name} onChange={(e) => setMaterials((prev) => prev.map((x) => x.id === m.id ? { ...x, name: e.target.value } : x))} />
              <Input label="Default price" type="number" value={m.default_price} onChange={(e) => setMaterials((prev) => prev.map((x) => x.id === m.id ? { ...x, default_price: Number(e.target.value) } : x))} />
              <Input label="Shelf life days" type="number" value={m.shelf_life_days} onChange={(e) => setMaterials((prev) => prev.map((x) => x.id === m.id ? { ...x, shelf_life_days: Number(e.target.value) } : x))} />
              <Button className="self-end" onClick={() => void updateRawMaterial(m.id, { name: m.name, default_price: m.default_price, shelf_life_days: m.shelf_life_days })}>Save</Button>
            </Card>
          ))}
        </div>
      )}

      {active === 'packages' && (
        <div className="space-y-3">
          {packages.map((p) => (
            <Card key={p.id} className="grid gap-2 md:grid-cols-3">
              <Input label="Label" value={p.label} onChange={(e) => setPackages((prev) => prev.map((x) => x.id === p.id ? { ...x, label: e.target.value } : x))} />
              <Input label="Packaging cost" type="number" value={p.packaging_cost} onChange={(e) => setPackages((prev) => prev.map((x) => x.id === p.id ? { ...x, packaging_cost: Number(e.target.value) } : x))} />
              <Button className="self-end" onClick={() => void updateProductPackage(p.id, { label: p.label, packaging_cost: p.packaging_cost })}>Save</Button>
            </Card>
          ))}
        </div>
      )}

      {active === 'recipes' && (
        <div className="space-y-3">
          {recipes.map((r) => (
            <Card key={r.id} className="grid gap-2 md:grid-cols-4">
              <Input label="Name" value={r.name} onChange={(e) => setRecipes((prev) => prev.map((x) => x.id === r.id ? { ...x, name: e.target.value } : x))} />
              <Input label="Expected oil (L)" type="number" value={r.expected_oil_litres} onChange={(e) => setRecipes((prev) => prev.map((x) => x.id === r.id ? { ...x, expected_oil_litres: Number(e.target.value) } : x))} />
              <Input label="Expected waste (kg)" type="number" value={r.expected_waste_kg} onChange={(e) => setRecipes((prev) => prev.map((x) => x.id === r.id ? { ...x, expected_waste_kg: Number(e.target.value) } : x))} />
              <Button className="self-end" onClick={() => void updateRecipe(r.id, { name: r.name, expected_oil_litres: r.expected_oil_litres, expected_waste_kg: r.expected_waste_kg })}>Save</Button>
            </Card>
          ))}
        </div>
      )}

      {active === 'categories' && (
        <Card className="text-sm text-slate-600">
          Expense categories are seeded at onboarding. Add more from Supabase or extend this screen later.
          <ul className="mt-2 list-disc pl-5">
            {categories.map((c) => <li key={c.id}>{c.name}</li>)}
          </ul>
        </Card>
      )}

      {active === 'pricing' && (
        <div className="space-y-3">
          {products.filter((p) => !p.is_waste).map((p) => (
            <Card key={p.id} className="grid gap-2 md:grid-cols-4">
              <p className="font-medium md:col-span-1">{p.name}</p>
              <Input label="Retail" type="number" value={p.retail_price} onChange={(e) => setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, retail_price: Number(e.target.value) } : x))} />
              <Input label="Wholesale" type="number" value={p.wholesale_price} onChange={(e) => setProducts((prev) => prev.map((x) => x.id === p.id ? { ...x, wholesale_price: Number(e.target.value) } : x))} />
              <Button className="self-end" onClick={() => void updateProduct(p.id, { retail_price: p.retail_price, wholesale_price: p.wholesale_price })}>Save prices</Button>
            </Card>
          ))}
        </div>
      )}

      {active === 'data' && (
        <div className="max-w-2xl space-y-4">
          <Card className="space-y-3">
            <h3 className="font-semibold text-brand-900">7-day demo data</h3>
            <p className="text-sm text-slate-600">
              Inserts real purchases, production, bottling, sales, and expenses for 12–18 Sep 2026 into your Supabase
              account. You can only load once until you clear business data.
            </p>
            {demoLoaded ? (
              <Alert variant="success">
                Demo loaded{demoLoadedAt ? ` at ${new Date(demoLoadedAt).toLocaleString()}` : ''}.
              </Alert>
            ) : null}
            <Button
              disabled={demoLoaded || submit.isSaving}
              onClick={() => void submit.run(loadDemo, 'Demo loaded')}
            >
              Load 7-Day Demo Data
            </Button>
            <Button variant="secondary" onClick={() => void submit.run(runValidation, 'Validated')}>
              Run validation check
            </Button>
          </Card>

          {validation ? (
            <Card className="space-y-2 text-sm">
              <h3 className="font-semibold text-brand-900">Validation summary</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className="text-slate-500">Purchases</dt>
                <dd>₹{validation.purchase_total.toFixed(2)}</dd>
                <dt className="text-slate-500">Sales (subtotal)</dt>
                <dd>₹{validation.sales_subtotal.toFixed(2)}</dd>
                <dt className="text-slate-500">Expenses</dt>
                <dd>₹{validation.expenses_total.toFixed(2)}</dd>
                <dt className="text-slate-500">COGS</dt>
                <dd>₹{validation.cogs.toFixed(2)}</dd>
                <dt className="text-slate-500">Gross profit</dt>
                <dd>₹{validation.gross_profit.toFixed(2)}</dd>
                <dt className="text-slate-500">Net profit</dt>
                <dd>₹{validation.net_profit.toFixed(2)}</dd>
                <dt className="text-slate-500">Cash</dt>
                <dd>₹{validation.cash_balance.toFixed(2)}</dd>
                <dt className="text-slate-500">UPI</dt>
                <dd>₹{validation.upi_balance.toFixed(2)}</dd>
                <dt className="text-slate-500">Bank</dt>
                <dd>₹{validation.bank_balance.toFixed(2)}</dd>
                <dt className="text-slate-500">Negative raw batches</dt>
                <dd>{validation.negative_purchase_batches}</dd>
                <dt className="text-slate-500">Negative bulk batches</dt>
                <dd>{validation.negative_bulk_batches}</dd>
                <dt className="text-slate-500">Expiry alerts (30d)</dt>
                <dd>{validation.expiry_alerts}</dd>
              </dl>
            </Card>
          ) : null}

          <Card className="space-y-3">
            <h3 className="font-semibold text-brand-900">Clear all business data</h3>
            <p className="text-sm text-slate-600">
              Removes transactions, customers, and suppliers for your account. Master products and recipes stay. Auth
              account is never deleted.
            </p>
            {clearStep === 'idle' ? (
              <Button variant="secondary" onClick={() => setClearStep('phrase')}>
                Clear All Business Data
              </Button>
            ) : null}
            {clearStep === 'phrase' ? (
              <div className="space-y-3">
                <Input
                  label='Type exactly "raghul" to continue'
                  value={clearPhrase}
                  onChange={(e) => setClearPhrase(e.target.value)}
                  autoComplete="off"
                />
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => { setClearStep('idle'); setClearPhrase('') }}>
                    Cancel
                  </Button>
                  <Button
                    disabled={clearPhrase !== 'raghul'}
                    onClick={() => setClearStep('confirm')}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            ) : null}
            {clearStep === 'confirm' ? (
              <ConfirmPanel
                title="Delete all business data?"
                description="This cannot be undone. Suppliers, customers, purchases, sales, stock movements, and balances will be reset."
                confirmLabel="Yes, clear everything"
                onCancel={() => setClearStep('idle')}
                onConfirm={() => void submit.run(executeClear, 'Cleared')}
                loading={submit.isSaving}
              />
            ) : null}
          </Card>

          <Card className="space-y-3">
            <p className="text-sm text-slate-600">Re-run default master data seed (safe if products already exist).</p>
            <Button variant="secondary" onClick={() => void submit.run(reseed, 'Seed complete')}>
              Run default data seed
            </Button>
          </Card>
        </div>
      )}
    </div>
    </PageShell>
  )
}
