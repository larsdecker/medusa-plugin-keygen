
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { env } from "../../../../../config/env"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const account = env.KEYGEN_ACCOUNT
  const token = env.KEYGEN_TOKEN
  if (!account || !token) {
    return res.status(500).json({ message: "KEYGEN_ACCOUNT/TOKEN missing" })
  }
  const version = env.KEYGEN_VERSION

  const { sourcePolicyId, targetProductId, overrides } = (req.body ?? {}) as {
    sourcePolicyId: string
    targetProductId: string
    overrides?: {
      name?: string
      maxMachines?: number
      floating?: boolean
      duration?: number
      entitlementIds?: string[]
    }
  }

  if (!sourcePolicyId || !targetProductId) {
    return res.status(400).json({ message: "sourcePolicyId and targetProductId are required fields" })
  }

  // 1) Read source policy
  const host = env.KEYGEN_HOST
  const src = await fetch(`${host}/v1/accounts/${account}/policies/${sourcePolicyId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Keygen-Version": version }
  })
  if (!src.ok) {
    const text = await src.text().catch(() => "")
    return res.status(src.status).json({ message: text || src.statusText })
  }
  const srcJson = await src.json() as any
  const attrs = srcJson?.data?.attributes || {}

  const payload: any = {
    data: {
      type: "policies",
      attributes: {
        name: overrides?.name ?? attrs.name,
        ...(overrides?.maxMachines != null ? { maxMachines: overrides.maxMachines } : (attrs.maxMachines != null ? { maxMachines: attrs.maxMachines } : {})),
        ...(overrides?.floating != null ? { floating: overrides.floating } : (attrs.floating != null ? { floating: attrs.floating } : {})),
        ...(overrides?.duration != null ? { duration: overrides.duration } : (attrs.duration != null ? { duration: attrs.duration } : {})),
      },
      relationships: {
        product: { data: { type: "products", id: targetProductId } }
      }
    }
  }

  // 2) Create new policy on target product
  const r = await fetch(`${host}/v1/accounts/${account}/policies`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "Keygen-Version": version,
    },
    body: JSON.stringify(payload),
  })

  if (!r.ok) {
    const text = await r.text().catch(() => "")
    return res.status(r.status).json({ message: text || r.statusText })
  }

  const json = await r.json() as any
  const newId = json?.data?.id

  // 3) Entitlements: clone from source unless overrides specify a custom set
  let entitlementsToAttach: string[] | undefined = overrides?.entitlementIds
  if (!entitlementsToAttach) {
    const ents = await fetch(`${host}/v1/accounts/${account}/policies/${sourcePolicyId}/entitlements`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "Keygen-Version": version }
    })
    if (ents.ok) {
      const entsJson = await ents.json() as any
      entitlementsToAttach = (entsJson?.data || []).map((e: any) => e?.id).filter(Boolean)
    }
  }

  if (newId && entitlementsToAttach && entitlementsToAttach.length > 0) {
    await fetch(`${host}/v1/accounts/${account}/policies/${newId}/relationships/entitlements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Keygen-Version": version,
      },
      body: JSON.stringify({
        data: entitlementsToAttach.map((eid) => ({ type: "entitlements", id: eid }))
      })
    })
  }

  return res.status(201).json({ id: newId })
}
