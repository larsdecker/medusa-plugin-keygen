
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  const account = process.env.KEYGEN_ACCOUNT
  const token = process.env.KEYGEN_TOKEN
  if (!account || !token) {
    return res.status(500).json({ message: "KEYGEN_ACCOUNT/TOKEN missing" })
  }

  const r = await fetch(`https://api.keygen.sh/v1/accounts/${account}/entitlements`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  })

  if (!r.ok) {
    const text = await r.text().catch(() => "")
    return res.status(r.status).json({ message: text || r.statusText })
  }

  const json = await r.json() as any
  const data = (json?.data || []).map((e: any) => ({
    id: e?.id,
    code: e?.attributes?.code,
    name: e?.attributes?.name,
  }))

  return res.json({ data })
}
