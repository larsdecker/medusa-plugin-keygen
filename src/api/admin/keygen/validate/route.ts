
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { env } from "../../../../config/env"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { type, id } = (req.body ?? {}) as { type: "product" | "policy"; id: string }
  const account = env.KEYGEN_ACCOUNT
  const token = env.KEYGEN_TOKEN
  const version = env.KEYGEN_VERSION

  if (!account || !token) {
    return res.status(500).json({ message: "KEYGEN_ACCOUNT/TOKEN missing" })
  }
  if (!id || (type !== "product" && type !== "policy")) {
    return res.status(400).json({ message: "Invalid request" })
  }

  const host = env.KEYGEN_HOST
  const url =
    type === "product"
      ? `${host}/v1/accounts/${account}/products/${id}`
      : `${host}/v1/accounts/${account}/policies/${id}`

  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Keygen-Version": version,
    },
  })

  if (!r.ok) {
    const text = await r.text().catch(() => "")
    console.error(
      `[keygen] validation request failed: ${r.status} ${text || r.statusText}`
    )
    return res.status(r.status).json({ message: "Validation failed" })
  }

  const json = (await r.json()) as {
    data?: { id?: string; attributes?: { name?: string; code?: string } }
  }
  const name =
    json?.data?.attributes?.name ||
    json?.data?.id ||
    (type === "policy" ? json?.data?.attributes?.code : undefined)

  return res.json({ id, type, name })
}
