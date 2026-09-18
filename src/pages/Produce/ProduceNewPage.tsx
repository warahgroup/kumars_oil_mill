import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { PageShell } from '@/components/common/PageShell'
import { StickyActions } from '@/components/common/StickyActions'
import { formatCurrency } from '@/lib/format'
import { useSubmit } from '@/hooks/useSubmit'
import {
  listProducts,
  listRecipeIngredients,
  listRecipes,
  listRawMaterials,
} from '@/services/masterDataService'
import { estimateProductionCost, saveProduction } from '@/services/productionService'
import type { Recipe } from '@/types/entities'

function addDays(date: string, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function ProduceNewPage() {
  const navigate = useNavigate()
  const submit = useSubmit()
  const [step, setStep] = useState(1)
  const [products, setProducts] = useState<Awaited<ReturnType<typeof listProducts>>>([])
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [materials, setMaterials] = useState<Awaited<ReturnType<typeof listRawMaterials>>>([])
  const [ingredients, setIngredients] = useState<Awaited<ReturnType<typeof listRecipeIngredients>>>([])
  const [productId, setProductId] = useState('')
  const [recipeId, setRecipeId] = useState('')
  const [inputQty, setInputQty] = useState('10')
  const [actualOil, setActualOil] = useState('')
  const [actualWaste, setActualWaste] = useState('')
  const [labour, setLabour] = useState('0')
  const [electricity, setElectricity] = useState('0')
  const [overhead, setOverhead] = useState('0')
  const [wasteValue, setWasteValue] = useState('0')
  const [productionDate, setProductionDate] = useState(new Date().toISOString().slice(0, 10))
  const [estimate, setEstimate] = useState<Awaited<ReturnType<typeof estimateProductionCost>> | null>(null)
  const [estimateError, setEstimateError] = useState<string | null>(null)

  const recipe = recipes.find((r) => r.id === recipeId)

  useEffect(() => {
    void Promise.all([listProducts(), listRecipes(), listRawMaterials()]).then(([p, r, m]) => {
      setProducts(p.filter((x) => x.is_oil))
      setRecipes(r)
      setMaterials(m)
    })
  }, [])

  useEffect(() => {
    if (!recipeId) return
    void listRecipeIngredients(recipeId).then(setIngredients)
  }, [recipeId])

  const productRecipes = recipes.filter((r) => r.output_product_id === productId)

  useEffect(() => {
    if (productRecipes.length === 1) setRecipeId(productRecipes[0].id)
  }, [productId, productRecipes])

  const expected = useMemo(() => {
    if (!recipe) return null
    const q = Number(inputQty)
    if (!q) return null
    const scale = q / Number(recipe.base_raw_qty)
    return {
      oil: Number(recipe.expected_oil_litres) * scale,
      waste: Number(recipe.expected_waste_kg) * scale,
    }
  }, [recipe, inputQty])

  useEffect(() => {
    if (!recipe) return
    const q = Number(inputQty)
    if (!q) return
    void estimateProductionCost(
      recipe,
      q,
      Number(labour),
      Number(electricity),
      Number(overhead),
      Number(wasteValue),
    )
      .then((e) => {
        setEstimate(e)
        setEstimateError(null)
        if (!actualOil) setActualOil(e.oilOut.toFixed(3))
        if (!actualWaste) setActualWaste(e.wasteOut.toFixed(3))
      })
      .catch((err) => {
        setEstimate(null)
        setEstimateError(err instanceof Error ? err.message : 'Cannot estimate cost')
      })
  }, [recipe, inputQty, labour, electricity, overhead, wasteValue])

  async function handleSave() {
    if (!recipe) throw new Error('Select recipe')
    const oil = Number(actualOil)
    const waste = Number(actualWaste)
    if (!oil || oil <= 0) throw new Error('Enter actual oil output')
    await saveProduction({
      recipe_id: recipe.id,
      input_qty: Number(inputQty),
      recipe,
      oil_output_litres: oil,
      waste_output_kg: waste,
      production_date: productionDate,
      expiry_date: addDays(productionDate, 180),
      labour_cost: Number(labour),
      electricity_cost: Number(electricity),
      overhead_cost: Number(overhead),
      waste_value: Number(wasteValue),
    })
    navigate('/produce')
  }

  const materialName = (id: string | null) => materials.find((m) => m.id === id)?.name ?? '—'

  return (
    <PageShell title="New production" subtitle={`Step ${step} of 4`} backTo="/produce">
    <div className="space-y-4 max-w-2xl">

      {step === 1 && (
        <Card className="space-y-4">
          <Select label="Product" value={productId} onChange={(e) => { setProductId(e.target.value); setRecipeId('') }} options={products.map((p) => ({ value: p.id, label: p.name }))} />
          <Select label="Recipe" value={recipeId} onChange={(e) => setRecipeId(e.target.value)} options={productRecipes.map((r) => ({ value: r.id, label: r.name }))} />
          <Button onClick={() => setStep(2)} disabled={!recipeId}>Next</Button>
        </Card>
      )}

      {step === 2 && recipe && (
        <Card className="space-y-4">
          <p className="text-sm font-medium">Ingredients (from recipe)</p>
          <ul className="list-disc pl-5 text-sm text-slate-600">
            {ingredients.map((i) => (
              <li key={i.id}>{materialName(i.raw_material_id)} — {i.quantity} {i.unit}</li>
            ))}
          </ul>
          <Input label="Production input quantity (base raw qty)" type="number" value={inputQty} onChange={(e) => setInputQty(e.target.value)} />
          {expected ? (
            <p className="text-sm">Expected output: {expected.oil.toFixed(2)} L oil, {expected.waste.toFixed(2)} kg waste</p>
          ) : null}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button onClick={() => setStep(3)}>Next</Button>
          </div>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-4">
          <Input label="Actual oil output (L)" type="number" value={actualOil} onChange={(e) => setActualOil(e.target.value)} />
          <Input label="Actual waste (kg)" type="number" value={actualWaste} onChange={(e) => setActualWaste(e.target.value)} />
          <Input label="Labour cost" type="number" value={labour} onChange={(e) => setLabour(e.target.value)} />
          <Input label="Electricity cost" type="number" value={electricity} onChange={(e) => setElectricity(e.target.value)} />
          <Input label="Overhead cost" type="number" value={overhead} onChange={(e) => setOverhead(e.target.value)} />
          <Input label="Waste value (credit)" type="number" value={wasteValue} onChange={(e) => setWasteValue(e.target.value)} />
          <Input label="Production date" type="date" value={productionDate} onChange={(e) => setProductionDate(e.target.value)} />
          {estimateError ? <Alert variant="error">{estimateError}</Alert> : null}
          {estimate ? (
            <div className="rounded-xl bg-slate-50 p-3 text-sm">
              <p>Estimated cost (FEFO batches): {formatCurrency(estimate.estimatedCost)}</p>
              <p>Estimated cost/L: {formatCurrency(estimate.costPerLitre)}</p>
            </div>
          ) : null}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
            <Button onClick={() => setStep(4)}>Review</Button>
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="space-y-4">
          <p className="text-sm">FEFO consumption and frozen batch cost will be saved on confirm.</p>
          {submit.error ? <Alert variant="error">{submit.error}</Alert> : null}
          {submit.successMessage ? <Alert variant="success">{submit.successMessage}</Alert> : null}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(3)}>Back</Button>
            <StickyActions>
              <Button fullWidth size="lg" className="bg-action-production" disabled={submit.isSaving} onClick={() => void submit.run(handleSave, 'Production completed')}>
                {submit.isSaving ? 'Saving…' : 'Confirm production'}
              </Button>
            </StickyActions>
          </div>
        </Card>
      )}
    </div>
    </PageShell>
  )
}
