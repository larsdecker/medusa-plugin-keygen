
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { env } from "../../../../config/env"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const account = env.KEYGEN_ACCOUNT
  const token = env.KEYGEN_TOKEN
  if (!account || !token) {
    return res.status(500).json({ message: "KEYGEN_ACCOUNT/TOKEN missing" })
  }
  const version = env.KEYGEN_VERSION
  const productId = (req.query?.productId as string) || ""

  const host = env.KEYGEN_HOST
  let url = `${host}/v1/accounts/${account}/policies`
  if (productId) {
    const u = new URL(url)
    // filter by product
    u.searchParams.set("filter[product]", productId)
    url = u.toString()
  }

  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Keygen-Version": version,
    },
  })

  if (!r.ok) {
    const text = await r.text().catch(() => "")
    return res.status(r.status).json({ message: text || r.statusText })
  }

  const json = await r.json() as any
  const data = (json?.data || []).map((p: any) => ({
    id: p?.id,
    name: p?.attributes?.name,
  }))

  return res.json({ data })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const account = env.KEYGEN_ACCOUNT
  const token = env.KEYGEN_TOKEN
  if (!account || !token) {
    return res.status(500).json({ message: "KEYGEN_ACCOUNT/TOKEN missing" })
  }
  const version = env.KEYGEN_VERSION

  const { productId, name, maxMachines, floating, duration, entitlementIds } = (req.body ?? {}) as {
    productId: string
    name: string
    maxMachines?: number
    floating?: boolean
    duration?: number
    entitlementIds?: string[]
  }

  if (!productId || !name) {
    return res.status(400).json({ message: "productId and name are required fields" })
  }

  const payload: any = {
    data: {
      type: "policies",
      attributes: {
        name,
        ...(typeof maxMachines === "number" ? { maxMachines } : {}),
        ...(typeof floating === "boolean" ? { floating } : {}),
        ...(typeof duration === "number" ? { duration } : {}),
      },
      relationships: {
        product: { data: { type: "products", id: productId } }
      }
    }
  }

  const host = env.KEYGEN_HOST
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
  const id = json?.data?.id
  const createdName = json?.data?.attributes?.name

  // attach entitlements if provided
  if (id && Array.isArray(entitlementIds) && entitlementIds.length > 0) {
    await fetch(`${host}/v1/accounts/${account}/policies/${id}/relationships/entitlements`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
        "Keygen-Version": version,
      },
      body: JSON.stringify({
        data: entitlementIds.map((eid) => ({ type: "entitlements", id: eid }))
      })
    })
  }

  return res.status(201).json({ id, name: createdName })
}
