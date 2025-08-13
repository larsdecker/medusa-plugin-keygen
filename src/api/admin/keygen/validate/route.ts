
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { type, id } = (req.body ?? {}) as { type: "product" | "policy"; id: string }
  const account = process.env.KEYGEN_ACCOUNT
  const token = process.env.KEYGEN_TOKEN

  if (!account || !token) {
    return res.status(500).json({ message: "KEYGEN_ACCOUNT/TOKEN missing" })
  }
  if (!id || (type !== "product" && type !== "policy")) {
    return res.status(400).json({ message: "Invalid request" })
  }

  const host = process.env.KEYGEN_HOST || "https://api.keygen.sh"
  const url =
    type === "product"
      ? `${host}/v1/accounts/${account}/products/${id}`
      : `${host}/v1/accounts/${account}/policies/${id}`

  const r = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })

  if (!r.ok) {
    const text = await r.text().catch(() => "")
    return res.status(r.status).json({ message: text || r.statusText })
  }

  const json = (await r.json()) as any
  const name =
    json?.data?.attributes?.name ||
    json?.data?.id ||
    (type === "policy" ? json?.data?.attributes?.code : undefined)

  return res.json({ id, type, name })
}
