import { useState } from 'react'
import { Alert } from '@/components/ui/Alert'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { PageShell } from '@/components/common/PageShell'
import { PageState } from '@/components/common/PageState'
import { formatCurrency, formatDate } from '@/lib/format'
import { formatCustomerAddress, parseCustomerAddress } from '@/lib/customerAddress'
import { useQuery } from '@/hooks/useQuery'
import { useSubmit } from '@/hooks/useSubmit'
import { listCustomers, upsertCustomer } from '@/services/masterDataService'
import { listCustomerSales } from '@/services/salesService'

export default function CustomersPage() {
  const [search, setSearch] = useState('')
  const { state, reload } = useQuery(() => listCustomers(search), [search])
  const submit = useSubmit()

  const [editingId, setEditingId] = useState<string | undefined>()
  const [customerName, setCustomerName] = useState('')
  const [shopName, setShopName] = useState('')
  const [phone, setPhone] = useState('')
  const [area, setArea] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const salesQuery = useQuery(
    () => (selectedId ? listCustomerSales(selectedId) : Promise.resolve([])),
    [selectedId],
  )

  const customers = state.status === 'success' ? state.data : []

  function startEdit(id?: string) {
    const c = customers.find((x) => x.id === id)
    if (!c) {
      setEditingId(undefined)
      setCustomerName('')
      setShopName('')
      setPhone('')
      setArea('')
      return
    }
    const parsed = parseCustomerAddress(c.address)
    setEditingId(c.id)
    setCustomerName(c.name)
    setShopName(parsed.shopName)
    setPhone(c.phone ?? '')
    setArea(parsed.area)
  }

  async function handleSave() {
    if (!customerName.trim()) throw new Error('Customer name required')
    await upsertCustomer({
      id: editingId,
      name: customerName.trim(),
      phone: phone.trim() || undefined,
      address: formatCustomerAddress(shopName, area),
      customer_type: shopName ? 'wholesale' : 'retail',
    })
    setEditingId(undefined)
    reload()
  }

  return (
    <PageShell title="Customers" subtitle="Shops and buyers">
    <div className="grid gap-6 lg:grid-cols-2">
      {state.status === 'loading' ? <PageState status="loading" label="Loading customers…" /> : null}
      {state.status === 'error' ? <PageState status="error" message={state.message} onRetry={reload} /> : null}
      {state.status === 'success' ? (
      <>
      <div>
        <Input label="Search" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="mt-3 space-y-2">
          {customers.map((c) => (
            <button key={c.id} type="button" className="w-full text-left" onClick={() => { setSelectedId(c.id); startEdit(c.id) }}>
              <Card className="text-sm">
                <p className="font-semibold">{c.name}</p>
                <p className="text-slate-500">{c.phone ?? 'No phone'}</p>
              </Card>
            </button>
          ))}
        </div>
      </div>

      <div>
        <Card className="space-y-3">
          <h2 className="font-semibold">{editingId ? 'Edit customer' : 'Add customer'}</h2>
          <Input label="Shop name" value={shopName} onChange={(e) => setShopName(e.target.value)} />
          <Input label="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
          <Input label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Area / address" value={area} onChange={(e) => setArea(e.target.value)} />
          {submit.error ? <Alert variant="error">{submit.error}</Alert> : null}
          <div className="flex gap-2">
            <Button disabled={submit.isSaving} onClick={() => void submit.run(handleSave, 'Customer saved')}>Save</Button>
            <Button variant="secondary" onClick={() => startEdit()}>Clear</Button>
          </div>
        </Card>

        {selectedId && salesQuery.state.status === 'success' ? (
          <Card className="mt-4">
            <h3 className="mb-2 font-semibold">Sales history</h3>
            {salesQuery.state.data.length === 0 ? (
              <p className="text-sm text-slate-500">No sales for this customer.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {salesQuery.state.data.map((s) => (
                  <li key={s.id} className="flex justify-between">
                    <span>{s.reference_no ?? s.id.slice(0, 8)} · {formatDate(s.sale_date)}</span>
                    <span>{formatCurrency(Number(s.total_amount))}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : null}
      </div>
      </>
      ) : null}
    </div>
    </PageShell>
  )
}
