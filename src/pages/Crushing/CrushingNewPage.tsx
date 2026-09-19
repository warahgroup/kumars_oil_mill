import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { PageShell } from '@/components/common/PageShell'
import { formatCurrency, formatDate } from '@/lib/format'
import { localIsoDate } from '@/lib/dateRangeFilter'
import {
  CRUSHING_RAW_CODES,
  DEFAULT_CRUSHING_SETTINGS,
  computeCrushingSettlement,
  cakeProductCodeForRaw,
} from '@/lib/crushingConfig'
import { expectedOutputForInputKg } from '@/lib/recipePerKg'
import { useSubmit } from '@/hooks/useSubmit'
import { accountIdByType, usePaymentAccounts } from '@/hooks/usePaymentAccounts'
import { listRawMaterials, listRecipes } from '@/services/masterDataService'
import { getCrushingSettings, getCrushingWalkInCustomerId, saveCrushing } from '@/services/crushingService'
import type { AccountType } from '@/types/entities'

function chip(active: boolean): string {
  const b = 'min-h-12 w-full rounded-xl border-2 px-4 py-3 text-left font-bold'
  return active ? `${b} border-accent-400 bg-accent-300/20 text-slate-100` : `${b} border-brand-600 bg-brand-800 text-slate-100`
}

export default function CrushingNewPage() {
  const navigate = useNavigate()
  const submit = useSubmit()
  const accounts = usePaymentAccounts()
  const TOTAL_STEPS = 5
  const [step, setStep] = useState(1)

  const [materials, setMaterials] = useState<Awaited<ReturnType<typeof listRawMaterials>>>([])
  const [recipes, setRecipes] = useState<Awaited<ReturnType<typeof listRecipes>>>([])
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getCrushingSettings>> | null>(null)

  const [rawMaterialId, setRawMaterialId] = useState('')
  const [inputKg, setInputKg] = useState('')
  const [crushingDate, setCrushingDate] = useState(() => localIsoDate())

  const [oilL, setOilL] = useState('')
  const [cakeKg, setCakeKg] = useState('')

  const [cakeHandling, setCakeHandling] = useState<'customer_takes' | 'sell_to_mill' | ''>('')
  const [payment, setPayment] = useState<AccountType>('cash')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void Promise.all([listRawMaterials(), listRecipes(), getCrushingSettings()]).then(([m, r, s]) => {
      setMaterials(m.filter((x) => CRUSHING_RAW_CODES.includes(x.code as typeof CRUSHING_RAW_CODES[number])))
      setRecipes(r)
      setSettings(s)
    })
  }, [])

  const material = materials.find((m) => m.id === rawMaterialId)
  const input = Number(inputKg)
  const oil = Number(oilL)
  const cake = Number(cakeKg)

  const crushingRate = useMemo(() => {
    if (!material) return null
    const fromSettings = settings?.charge_per_kg_by_raw_code[material.code]
    const fallback = DEFAULT_CRUSHING_SETTINGS.charge_per_kg_by_raw_code[material.code]
    return fromSettings ?? fallback ?? 0
  }, [material, settings])

  const cakeCode = material ? cakeProductCodeForRaw(material.code) : null
  const cakeRate = useMemo(() => {
    if (cakeHandling !== 'sell_to_mill' || !cakeCode) return 0
    const fromSettings = settings?.cake_rate_by_product_code[cakeCode]
    const fallback = DEFAULT_CRUSHING_SETTINGS.cake_rate_by_product_code[cakeCode]
    return fromSettings ?? fallback ?? 0
  }, [cakeHandling, cakeCode, settings])

  const guide = useMemo(() => {
    if (!material || !input) return null
    const recipe = recipes.find((r) => r.base_raw_material_id === material.id)
    if (!recipe) return null
    return expectedOutputForInputKg(recipe, input)
  }, [material, input, recipes])

  const settlement = useMemo(() => {
    if (!input || crushingRate === null || !cakeHandling) return null
    return computeCrushingSettlement(input, crushingRate, cake || 0, cakeHandling, cakeRate)
  }, [input, crushingRate, cake, cakeHandling, cakeRate])

  async function handleSave() {
    if (!rawMaterialId) throw new Error('Complete all steps')
    if (!cakeHandling) throw new Error('Choose what happens to the cake')
    if (!settlement) throw new Error('Invalid settlement')
    if (accounts.state.status !== 'success') throw new Error('Loading accounts…')
    const accountId = accountIdByType(accounts.state.data, payment)
    if (!accountId) throw new Error('Choose payment method')
    if (settlement.direction !== 'settled' && !accountId) throw new Error('Payment method required')

    const customerId = await getCrushingWalkInCustomerId()

    const id = await saveCrushing({
      customer_id: customerId,
      raw_material_id: rawMaterialId,
      crushing_date: crushingDate,
      input_quantity: input,
      oil_output_quantity: oil || 0,
      cake_output_quantity: cake || 0,
      cake_handling: cakeHandling,
      crushing_rate_per_kg: crushingRate ?? 0,
      cake_purchase_rate_per_kg: cakeHandling === 'sell_to_mill' ? cakeRate : undefined,
      financial_account_id: accountId,
    })
    navigate(`/crushing/${id}`)
  }

  return (
    <PageShell title="New crushing" subtitle={`Step ${step} of ${TOTAL_STEPS}`} backTo="/crushing">
      <div className="mx-auto max-w-lg space-y-4">
        {error ? <Alert variant="error">{error}</Alert> : null}
        {submit.error ? <Alert variant="error">{submit.error}</Alert> : null}

        {step === 1 && (
          <Card className="space-y-4">
            <p className="font-semibold">Date &amp; quantity</p>
            <Input label="Date" type="date" value={crushingDate} onChange={(e) => setCrushingDate(e.target.value)} />
            <Select
              label="Raw material"
              value={rawMaterialId}
              onChange={(e) => setRawMaterialId(e.target.value)}
              options={materials.map((m) => ({ value: m.id, label: m.name }))}
            />
            <Input
              label="Received weight (kg)"
              type="number"
              min="0"
              step="0.01"
              value={inputKg}
              onChange={(e) => setInputKg(e.target.value)}
            />
            {material && input > 0 ? (
              <p className="text-sm font-medium text-slate-200">
                {formatDate(crushingDate)} · {input} kg {material.name}
              </p>
            ) : null}
            <Button fullWidth disabled={!rawMaterialId || !input} onClick={() => setStep(2)}>
              Next
            </Button>
          </Card>
        )}

        {step === 2 && material && (
          <Card className="space-y-4">
            <p className="font-semibold">Crushing result</p>
            <p className="text-sm text-slate-600">Input: {input} kg {material.name}</p>
            {guide ? (
              <p className="text-sm text-slate-600">
                Guide only: about {guide.oilLitres.toFixed(1)} L oil, {guide.wasteKg.toFixed(1)} kg cake
              </p>
            ) : null}
            <Input label="Actual oil (L)" type="number" min="0" step="0.1" value={oilL} onChange={(e) => setOilL(e.target.value)} />
            <Input label="Actual cake (kg)" type="number" min="0" step="0.1" value={cakeKg} onChange={(e) => setCakeKg(e.target.value)} />
            <Card className="border-accent-400/40 bg-accent-300/10">
              <p className="text-xs font-bold uppercase text-slate-500">Oil to return</p>
              <p className="text-xl font-bold">{oil || '—'} L</p>
              <p className="text-sm text-slate-600">Give this oil back. It is not mill stock.</p>
            </Card>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Next</Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card className="space-y-4">
            <p className="font-semibold">What happens to the cake?</p>
            <p className="text-sm">{cake || 0} kg cake produced</p>
            <button type="button" className={chip(cakeHandling === 'customer_takes')} onClick={() => setCakeHandling('customer_takes')}>
              They take the cake
            </button>
            <button type="button" className={chip(cakeHandling === 'sell_to_mill')} onClick={() => setCakeHandling('sell_to_mill')}>
              Sell cake to us
            </button>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
              <Button disabled={!cakeHandling} onClick={() => setStep(4)}>Next</Button>
            </div>
          </Card>
        )}

        {step === 4 && !settlement ? (
          <Card className="space-y-3">
            <p className="text-sm text-slate-400">Check weight and cake choice, then continue.</p>
            <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
          </Card>
        ) : null}

        {step === 4 && settlement && (
          <Card className="space-y-3">
            <p className="font-semibold">Final amount</p>
            <p>Crushing charge: {formatCurrency(settlement.crushingCharge)}</p>
            {settlement.cakeValue > 0 ? <p>Cake value: {formatCurrency(settlement.cakeValue)}</p> : null}
            {settlement.direction === 'customer_pays_mill' ? (
              <p className="text-lg font-bold text-brand-900">They pay {formatCurrency(settlement.net)}</p>
            ) : null}
            {settlement.direction === 'mill_pays_customer' ? (
              <p className="text-lg font-bold text-brand-900">We pay them {formatCurrency(settlement.net)}</p>
            ) : null}
            {settlement.direction === 'settled' ? <p className="font-bold">Settled — no payment</p> : null}
            {settlement.direction !== 'settled' ? (
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
            ) : null}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
              <Button onClick={() => setStep(5)}>Review</Button>
            </div>
          </Card>
        )}

        {step === 5 && settlement && material && (
          <Card className="space-y-3">
            <p className="font-semibold">Complete crushing</p>
            <p className="text-sm">
              {formatDate(crushingDate)} · {input} kg {material.name}
            </p>
            <p className="text-sm">Oil returned: {oil} L · Cake: {cake} kg</p>
            <Button
              fullWidth
              size="lg"
              className="bg-action-crushing"
              disabled={submit.isSaving}
              onClick={() => void submit.run(handleSave, 'Crushing saved')}
            >
              {submit.isSaving ? 'Saving…' : 'Complete crushing'}
            </Button>
            <Button variant="secondary" onClick={() => setStep(4)}>Back</Button>
          </Card>
        )}
      </div>
    </PageShell>
  )
}
