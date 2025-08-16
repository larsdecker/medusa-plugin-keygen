import { defineWidgetConfig } from '@medusajs/admin-sdk'
import type { DetailWidgetProps, AdminProductVariant } from '@medusajs/framework/types'
import { Container, Heading, Input, Button, Label, Text, Badge, Switch } from '@medusajs/ui'
import { useEffect, useMemo, useState } from 'react'
import { loadRecent, validateOnServer, ValidationResponse } from '../utils/keygen'

const LS_RECENT_PRODUCTS = 'keygen_recent_products'
const LS_RECENT_POLICIES = 'keygen_recent_policies'

async function patchVariantMetadata(variantId: string, meta: Record<string, unknown>) {
  const res = await fetch(`/admin/variants/${variantId}`, {
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

const KeygenVariantWidget = ({ data }: DetailWidgetProps<AdminProductVariant>) => {
  const currentMeta = data?.metadata ?? {}
  const [kp, setKp] = useState<string>(String(currentMeta['keygen_product'] ?? ''))
  const [kl, setKl] = useState<string>(String(currentMeta['keygen_policy'] ?? ''))
  const [vp, setVp] = useState<{ ok: boolean; message?: string; name?: string } | null>(null)
  const [vl, setVl] = useState<{ ok: boolean; message?: string; name?: string } | null>(null)
  const [autoValidate, setAutoValidate] = useState(true)

  const canSave = useMemo(
    () => kp !== String(currentMeta['keygen_product'] ?? '') || kl !== String(currentMeta['keygen_policy'] ?? ''),
    [kp, kl, currentMeta],
  )

  const [recentProducts, setRecentProducts] = useState<string[]>([])
  const [recentPolicies, setRecentPolicies] = useState<string[]>([])
  useEffect(() => {
    setRecentProducts(loadRecent(LS_RECENT_PRODUCTS))
    setRecentPolicies(loadRecent(LS_RECENT_POLICIES))
  }, [])

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
    await patchVariantMetadata(data.id, newMeta)
    window.location.reload()
  }

  if (!data?.id) return <></>

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Keygen (keygen.sh) – Variant</Heading>
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
    </Container>
  )
}

export const config = defineWidgetConfig({
  zone: 'product.variant.details.after',
})

export default KeygenVariantWidget
