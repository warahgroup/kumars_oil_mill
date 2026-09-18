import { useEffect, useState } from 'react'
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
import { formatCurrency, formatDate } from '@/lib/format'
import { useSubmit } from '@/hooks/useSubmit'
import { listProductPackages, listProducts } from '@/services/masterDataService'
import { listProductionBatches } from '@/services/stockService'
import { saveBottling } from '@/services/bottlingService'

export default function BottleNewPage() {
  const navigate = useNavigate()
  const submit = useSubmit()
  const [products, setProducts] = useState<Awaited<ReturnType<typeof listProducts>>>([])
  const [packages, setPackages] = useState<Awaited<ReturnType<typeof listProductPackages>>>([])
  const [batches, setBatches] = useState<Awaited<ReturnType<typeof listProductionBatches>>>([])
  const [productId, setProductId] = useState('')
  const [batchId, setBatchId] = useState('')
  const [packageId, setPackageId] = useState('')
  const [count, setCount] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)

  useEffect(() => {
    void Promise.all([listProducts(), listProductPackages(), listProductionBatches()]).then(
      ([p, pk, b]) => {
        setProducts(p.filter((x) => x.is_oil))
        setPackages(pk)
        setBatches(b)
      },
    )
  }, [])

  const productPackages = packages.filter((p) => p.product_id === productId)
  const productBatches = batches.filter(
    (b) => b.output_product_id === productId && Number(b.remaining_bulk_litres) > 0,
  )
  const pkg = packages.find((p) => p.id === packageId)
  const bottleCount = Number(count)
  const litresPerBottle = (pkg?.size_ml ?? 0) / 1000
  const oilUsed = litresPerBottle * bottleCount
  const packagingCost = (pkg?.packaging_cost ?? 0) * bottleCount

  const batch = batches.find((b) => b.id === batchId)
  const validBulk = batch ? Number(batch.remaining_bulk_litres) >= oilUsed : false

  async function handleSave() {
    if (!batchId || !packageId || !bottleCount) throw new Error('Please fill in all fields.')
    if (!validBulk) throw new Error('Not enough bulk oil in selected batch.')
    await saveBottling({
      production_batch_id: batchId,
      product_package_id: packageId,
      package_count: bottleCount,
      transaction_date: new Date().toISOString().slice(0, 10),
    })
    navigate('/bottle')
  }

  return (
    <PageShell title="Bottle oil" subtitle="Pack bulk oil into bottles" backTo="/bottle" width="narrow">
      {showConfirm ? (
        <ConfirmPanel
          title="Save bottling?"
          description={`${bottleCount} bottles · ${oilUsed.toFixed(2)} L oil used`}
          confirmLabel="Yes, save"
          onCancel={() => setShowConfirm(false)}
          loading={submit.isSaving}
          onConfirm={() => void submit.run(handleSave, 'Bottling saved')}
        />
      ) : (
        <Card className="space-y-4">
          <Select label="Oil" value={productId} onChange={(e) => { setProductId(e.target.value); setBatchId(''); setPackageId('') }} options={products.map((p) => ({ value: p.id, label: p.name }))} />
          <Select label="Production batch" value={batchId} onChange={(e) => setBatchId(e.target.value)} options={productBatches.map((b) => ({ value: b.id, label: `${formatDate(b.production_date)} — ${Number(b.remaining_bulk_litres).toFixed(1)} L left` }))} />
          <Select label="Package size" value={packageId} onChange={(e) => setPackageId(e.target.value)} options={productPackages.map((p) => ({ value: p.id, label: p.label }))} />
          <Input label="Number of bottles" type="number" min="1" value={count} onChange={(e) => setCount(e.target.value)} />
          {oilUsed > 0 ? (
            <CalculationPanel
              lines={[
                { label: 'Oil used', value: `${oilUsed.toFixed(2)} L`, emphasis: true },
                { label: 'Packaging cost', value: formatCurrency(packagingCost) },
              ]}
            />
          ) : null}
          {!validBulk && oilUsed > 0 ? <Alert variant="error">Not enough bulk oil in this batch.</Alert> : null}
          {submit.error ? <Alert variant="error">{submit.error}</Alert> : null}
        </Card>
      )}
      {!showConfirm ? (
        <StickyActions>
          <Button fullWidth size="lg" onClick={() => setShowConfirm(true)} disabled={!validBulk || !bottleCount}>
            Review & save
          </Button>
        </StickyActions>
      ) : null}
    </PageShell>
  )
}
