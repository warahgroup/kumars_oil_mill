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
import { localIsoDate } from '@/lib/dateRangeFilter'
import {
  expectedOutputForInputKg,
  ingredientQtyPerKgInput,
  oilLitresPerKgInput,
  wasteKgPerKgInput,
} from '@/lib/recipePerKg'
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
  const [inputQty, setInputQty] = useState('1')
  const [actualOil, setActualOil] = useState('')
  const [actualWaste, setActualWaste] = useState('')
  const [productionDate, setProductionDate] = useState(() => localIsoDate())
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

  const baseRawName = recipe
    ? materials.find((m) => m.id === recipe.base_raw_material_id)?.name ?? 'raw material'
    : 'raw material'

  const expected = useMemo(() => {
    if (!recipe) return null
    const q = Number(inputQty)
    if (!q) return null
    return expectedOutputForInputKg(recipe, q)
  }, [recipe, inputQty])

  const perKgYield = useMemo(() => {
    if (!recipe) return null
    return {
      oil: oilLitresPerKgInput(recipe),
      waste: wasteKgPerKgInput(recipe),
    }
  }, [recipe])

  useEffect(() => {
    if (!recipe) return
    const q = Number(inputQty)
    if (!q) return
    void estimateProductionCost(recipe, q)
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
  }, [recipe, inputQty])

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
    })
    navigate('/produce')
  }

  const materialName = (id: string | null) => materials.find((m) => m.id === id)?.name ?? '—'

  return (
    <PageShell title="New production" subtitle={`Step ${step} of 4`} backTo="/produce">
      <div className="space-y-4 max-w-2xl">
        {step === 1 && (
          <Card className="space-y-4">
            <Select
              label="Product"
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value)
                setRecipeId('')
              }}
              options={products.map((p) => ({ value: p.id, label: p.name }))}
            />
            <Select
              label="Recipe"
              value={recipeId}
              onChange={(e) => setRecipeId(e.target.value)}
              options={productRecipes.map((r) => ({ value: r.id, label: r.name }))}
            />
            <Button onClick={() => setStep(2)} disabled={!recipeId}>Next</Button>
          </Card>
        )}

        {step === 2 && recipe && (
          <Card className="space-y-4">
            <p className="text-sm font-medium">Ingredients per 1 kg {baseRawName}</p>
            <ul className="list-disc pl-5 text-sm text-slate-600">
              {ingredients.map((i) => (
                <li key={i.id}>
                  {materialName(i.raw_material_id)} — {ingredientQtyPerKgInput(i.quantity, recipe).toFixed(3)} kg
                </li>
              ))}
            </ul>
            {perKgYield ? (
              <p className="text-sm text-slate-600">
                Yield per 1 kg: {perKgYield.oil.toFixed(3)} L oil, {perKgYield.waste.toFixed(3)} kg waste
              </p>
            ) : null}
            <Input
              label={`Input quantity (kg ${baseRawName})`}
              type="number"
              min="0"
              step="0.001"
              value={inputQty}
              onChange={(e) => setInputQty(e.target.value)}
            />
            {expected ? (
              <p className="text-sm font-medium text-brand-900">
                Expected for {inputQty} kg: {expected.oilLitres.toFixed(2)} L oil, {expected.wasteKg.toFixed(2)} kg
                waste
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
              <Button onClick={() => setStep(3)}>Next</Button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card className="space-y-4">
            <Input
              label="Actual oil output (L)"
              type="number"
              value={actualOil}
              onChange={(e) => setActualOil(e.target.value)}
            />
            <Input
              label="Actual waste (kg)"
              type="number"
              value={actualWaste}
              onChange={(e) => setActualWaste(e.target.value)}
            />
            <Input
              label="Production date"
              type="date"
              value={productionDate}
              onChange={(e) => setProductionDate(e.target.value)}
            />
            {estimateError ? <Alert variant="error">{estimateError}</Alert> : null}
            {estimate ? (
              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <p>Estimated material cost (FEFO): {formatCurrency(estimate.estimatedCost)}</p>
                <p>Estimated cost per L: {formatCurrency(estimate.costPerLitre)}</p>
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
                <Button
                  fullWidth
                  size="lg"
                  className="bg-action-production"
                  disabled={submit.isSaving}
                  onClick={() => void submit.run(handleSave, 'Production completed')}
                >
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
