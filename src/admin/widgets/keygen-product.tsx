import { defineWidgetConfig } from '@medusajs/admin-sdk'
import type { DetailWidgetProps, AdminProduct } from '@medusajs/framework/types'
import { Container, Heading, Input, Button, Label, Text, Switch, Badge, Checkbox } from '@medusajs/ui'
import { useState, useMemo, useEffect } from 'react'
import { loadRecent, pushRecent, validateOnServer, ValidationResponse } from '../utils/keygen'

const LS_RECENT_PRODUCTS = 'keygen_recent_products'
const LS_RECENT_POLICIES = 'keygen_recent_policies'

async function listPolicies(productId: string) {
  const url = new URL(`/admin/keygen/policies`, window.location.origin)
  if (productId) url.searchParams.set('productId', productId)
  const res = await fetch(url.toString(), { credentials: 'include' })
  if (!res.ok) return []
  const json = await res.json()
  return (json?.data ?? []) as { id: string; name?: string }[]
}

async function listEntitlements() {
  const res = await fetch(`/admin/keygen/entitlements`, { credentials: 'include' })
  if (!res.ok) return []
  const json = await res.json()
  return (json?.data ?? []) as { id: string; code?: string; name?: string }[]
}

async function createPolicyServer(payload: {
  productId: string
  name: string
  maxMachines?: number
  floating?: boolean
  duration?: number
  entitlementIds?: string[]
}): Promise<{ id?: string }> {
  const res = await fetch(`/admin/keygen/policies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Policy create failed: ${res.status} ${t}`)
  }
  return await res.json()
}

async function clonePolicyServer(payload: {
  sourcePolicyId: string
  targetProductId: string
  overrides?: {
    name?: string
    maxMachines?: number
    floating?: boolean
    duration?: number
    entitlementIds?: string[]
  }
}): Promise<{ id?: string }> {
  const res = await fetch(`/admin/keygen/policies/clone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    credentials: 'include',
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Policy clone failed: ${res.status} ${t}`)
  }
  return await res.json()
}

async function patchProductMetadata(productId: string, meta: Record<string, unknown>) {
  const res = await fetch(`/admin/products/${productId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ metadata: meta }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Update failed: ${res.status} ${t}`)
  }
  return await res.json()
}

const KeygenProductWidget = ({ data }: DetailWidgetProps<AdminProduct>) => {
  const currentMeta = data?.metadata ?? {}
  const productDisplayName = data?.title ?? data?.handle ?? ''
  const [kp, setKp] = useState<string>(String(currentMeta['keygen_product'] ?? ''))
  const [kl, setKl] = useState<string>(String(currentMeta['keygen_policy'] ?? ''))
  const [autoValidate, setAutoValidate] = useState(true)
  const [vp, setVp] = useState<{ ok: boolean; message?: string; name?: string } | null>(null)
  const [vl, setVl] = useState<{ ok: boolean; message?: string; name?: string } | null>(null)
  const canSave = useMemo(
    () => kp !== String(currentMeta['keygen_product'] ?? '') || kl !== String(currentMeta['keygen_policy'] ?? ''),
    [kp, kl, currentMeta],
  )

  const [recentProducts, setRecentProducts] = useState<string[]>([])
  const [recentPolicies, setRecentPolicies] = useState<string[]>([])

  const [policies, setPolicies] = useState<{ id: string; name?: string }[]>([])
  const [entitlements, setEntitlements] = useState<{ id: string; code?: string; name?: string }[]>([])
  const [selectedEntitlements, setSelectedEntitlements] = useState<string[]>([])

  const [baseName, setBaseName] = useState('Annual')
  const [seats, setSeats] = useState<number>(2)
  const [floating, setFloating] = useState<boolean>(false)
  const [durationDays, setDurationDays] = useState<number>(365)
  const [autoName, setAutoName] = useState(true)

  const [cloneSourceId, setCloneSourceId] = useState('')
  const [cloneTargetProductId, setCloneTargetProductId] = useState('')
  const [cloneOverrideName, setCloneOverrideName] = useState('')
  const [cloneOverrideSeats, setCloneOverrideSeats] = useState<number | undefined>(undefined)
  const [cloneOverrideFloating, setCloneOverrideFloating] = useState<boolean | undefined>(undefined)
  const [cloneOverrideDurationDays, setCloneOverrideDurationDays] = useState<number | undefined>(undefined)

  useEffect(() => {
    setRecentProducts(loadRecent(LS_RECENT_PRODUCTS))
    setRecentPolicies(loadRecent(LS_RECENT_POLICIES))
  }, [])

  useEffect(() => {
    if (kp) {
      listPolicies(kp)
        .then(setPolicies)
        .catch(() => setPolicies([]))
      listEntitlements()
        .then(setEntitlements)
        .catch(() => setEntitlements([]))
    } else {
      setPolicies([])
    }
  }, [kp])

  const generatedName = `${productDisplayName ? productDisplayName + ' – ' : ''}${baseName} – ${seats} Seats${floating ? ' (Floating)' : ''}${durationDays ? ' – ' + durationDays + 'd' : ''}`

  async function handleValidate() {
    const resP: ValidationResponse = kp ? await validateOnServer('product', kp) : { ok: true }
    const resL: ValidationResponse = kl ? await validateOnServer('policy', kl) : { ok: true }
    setVp(resP.ok ? { ok: true, name: resP.data?.name } : { ok: false, message: resP.message })
    setVl(resL.ok ? { ok: true, name: resL.data?.name } : { ok: false, message: resL.message })
  }

  async function handleSave() {
    if (autoValidate) {
      const resP: ValidationResponse = kp ? await validateOnServer('product', kp) : { ok: true }
      const resL: ValidationResponse = kl ? await validateOnServer('policy', kl) : { ok: true }
      if (!resP.ok || !resL.ok) {
        setVp(resP.ok ? { ok: true, name: resP.data?.name } : { ok: false, message: resP.message })
        setVl(resL.ok ? { ok: true, name: resL.data?.name } : { ok: false, message: resL.message })
        return
      }
    }
    const newMeta = {
      ...currentMeta,
      keygen_product: kp || undefined,
      keygen_policy: kl || undefined,
    }
    await patchProductMetadata(data.id, newMeta)
    pushRecent(LS_RECENT_PRODUCTS, kp)
    pushRecent(LS_RECENT_POLICIES, kl)
    window.location.reload()
  }

  function toggleEntitlement(id: string) {
    setSelectedEntitlements((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleCreatePolicyAdvanced() {
    if (!kp) {
      alert('Please enter a Keygen Product ID (keygen_product) first.')
      return
    }
    const name = autoName ? generatedName : `${baseName}`
    const duration = durationDays && durationDays > 0 ? durationDays * 24 * 60 * 60 : undefined
    const resp = await createPolicyServer({
      productId: kp,
      name,
      maxMachines: seats,
      floating,
      duration,
      entitlementIds: selectedEntitlements,
    })
    const newId = resp?.id
    if (newId) {
      setKl(newId)
      setVl({ ok: true, name })
      pushRecent(LS_RECENT_POLICIES, newId)
      listPolicies(kp)
        .then(setPolicies)
        .catch(() => {})
    }
  }

  async function handleClonePolicy() {
    if (!cloneSourceId || !cloneTargetProductId) {
      alert('Please provide source policy and target product ID.')
      return
    }
    const overrides: Record<string, unknown> = {}
    if (cloneOverrideName) overrides.name = cloneOverrideName
    if (cloneOverrideSeats != null) overrides.maxMachines = cloneOverrideSeats
    if (cloneOverrideFloating != null) overrides.floating = cloneOverrideFloating
    if (cloneOverrideDurationDays != null) overrides.duration = cloneOverrideDurationDays * 24 * 60 * 60

    const resp = await clonePolicyServer({
      sourcePolicyId: cloneSourceId,
      targetProductId: cloneTargetProductId,
      overrides: Object.keys(overrides).length ? overrides : undefined,
    })
    const newId = resp?.id
    if (newId) {
      if (cloneTargetProductId === kp) {
        listPolicies(kp)
          .then(setPolicies)
          .catch(() => {})
      }
      setKl(newId)
      pushRecent(LS_RECENT_POLICIES, newId)
    }
  }

  if (!data?.id) return <></>

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Keygen (keygen.sh) – Mapping</Heading>
      </div>

      <div className="grid grid-cols-1 gap-4 p-6 md:grid-cols-2">
        <div>
          <Label>Keygen Product ID (keygen_product)</Label>
          <Input placeholder="prod_XXXX" value={kp} onChange={(e) => setKp(e.target.value)} />
          {vp?.ok && kp && <Text className="mt-1">✅ Found: {vp.name ?? 'OK'}</Text>}
          {vp?.ok === false && <Text className="mt-1 text-ui-fg-error">❌ {vp.message}</Text>}
          {recentProducts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {recentProducts.map((id) => (
                <Badge key={id} onClick={() => setKp(id)} variant="secondary">
                  {id}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label>Keygen Policy ID (keygen_policy)</Label>
          <Input placeholder="pol_XXXX" value={kl} onChange={(e) => setKl(e.target.value)} />
          {vl?.ok && kl && <Text className="mt-1">✅ Found: {vl.name ?? 'OK'}</Text>}
          {vl?.ok === false && <Text className="mt-1 text-ui-fg-error">❌ {vl.message}</Text>}
          {recentPolicies.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {recentPolicies.map((id) => (
                <Badge key={id} onClick={() => setKl(id)} variant="secondary">
                  {id}
                </Badge>
              ))}
            </div>
          )}
          {policies.length > 0 && (
            <div className="mt-3">
              <Label>Existing policies (for this product)</Label>
              <div className="mt-2 flex flex-col gap-2">
                {policies.map((p) => (
                  <Button key={p.id} variant="secondary" onClick={() => setKl(p.id)}>
                    {p.name ?? p.id} — {p.id}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="col-span-1 md:col-span-2 flex items-center gap-3">
          <Switch checked={autoValidate} onCheckedChange={setAutoValidate} />
          <Text>Automatically validate before saving</Text>
          <Button variant="secondary" onClick={handleValidate}>
            Validate only
          </Button>
          <div className="flex-1" />
          <Button disabled={!canSave} onClick={handleSave}>
            Save
          </Button>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-3">
        <Heading level="h3">Create policy (advanced)</Heading>
        <Text className="text-ui-fg-subtle">Name can be generated automatically if desired.</Text>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="md:col-span-2">
            <Checkbox checked={autoName} onCheckedChange={setAutoName} />
            <Label className="ml-2">Generate name automatically</Label>
            {autoName && (
              <Text className="block mt-1">
                Preview: <strong>{generatedName}</strong>
              </Text>
            )}
          </div>
          <div>
            <Label>Base name</Label>
            <Input
              placeholder="Annual"
              value={baseName}
              onChange={(e) => setBaseName(e.target.value)}
              disabled={autoName}
            />
          </div>
          <div>
            <Label>Seats (maxMachines)</Label>
            <Input type="number" min={1} value={seats} onChange={(e) => setSeats(parseInt(e.target.value || '1'))} />
          </div>
          <div>
            <Label>Duration (days)</Label>
            <Input
              type="number"
              min={0}
              value={durationDays}
              onChange={(e) => setDurationDays(parseInt(e.target.value || '0'))}
            />
            <Text className="text-ui-fg-subtle">0 = unlimited</Text>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={floating} onCheckedChange={setFloating} />
            <Label>Floating</Label>
          </div>
        </div>

        {entitlements.length > 0 && (
          <div className="mt-3">
            <Label>Attach entitlements</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {entitlements.map((e) => {
                const checked = selectedEntitlements.includes(e.id)
                const label = e.code || e.name || e.id
                return (
                  <Badge
                    asChild
                    key={e.id}
                    variant={checked ? 'primary' : 'secondary'}
                    onClick={() => toggleEntitlement(e.id)}
                  >
                    <button>{label}</button>
                  </Badge>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={handleCreatePolicyAdvanced}>Create policy</Button>
        </div>
      </div>

      <div className="px-6 pb-6 space-y-3">
        <Heading level="h3">Clone policy</Heading>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Source policy ID</Label>
            <Input placeholder="pol_XXXX" value={cloneSourceId} onChange={(e) => setCloneSourceId(e.target.value)} />
          </div>
          <div>
            <Label>Target product ID</Label>
            <Input
              placeholder="prod_XXXX"
              value={cloneTargetProductId}
              onChange={(e) => setCloneTargetProductId(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Text className="text-ui-fg-subtle">Optional overrides:</Text>
          </div>
          <div>
            <Label>Name</Label>
            <Input
              placeholder="(leave empty for original)"
              value={cloneOverrideName}
              onChange={(e) => setCloneOverrideName(e.target.value)}
            />
          </div>
          <div>
            <Label>Seats (maxMachines)</Label>
            <Input
              type="number"
              placeholder="(leave empty)"
              value={cloneOverrideSeats ?? ''}
              onChange={(e) => setCloneOverrideSeats(e.target.value ? parseInt(e.target.value) : undefined)}
            />
          </div>
          <div>
            <Label>Duration (days)</Label>
            <Input
              type="number"
              placeholder="(leave empty)"
              value={cloneOverrideDurationDays ?? ''}
              onChange={(e) => setCloneOverrideDurationDays(e.target.value ? parseInt(e.target.value) : undefined)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              checked={cloneOverrideFloating ?? false}
              onCheckedChange={(v) => setCloneOverrideFloating(v as boolean)}
            />
            <Label>Set floating (leave empty for original)</Label>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleClonePolicy}>Clone policy</Button>
        </div>
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: 'product.details.after',
})

export default KeygenProductWidget
