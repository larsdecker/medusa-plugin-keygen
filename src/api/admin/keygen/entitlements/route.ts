import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { env } from '../../../../config/env'

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  const account = env.KEYGEN_ACCOUNT
  const token = env.KEYGEN_TOKEN
  const version = env.KEYGEN_VERSION
  if (!account || !token) {
    return res.status(500).json({ message: 'KEYGEN_ACCOUNT/TOKEN missing' })
  }

  const host = env.KEYGEN_HOST
  const r = await fetch(`${host}/v1/accounts/${account}/entitlements`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Keygen-Version': version,
    },
  })

  if (!r.ok) {
    const text = await r.text().catch(() => '')
    return res.status(r.status).json({ message: text || r.statusText })
  }

  const json = (await r.json()) as {
    data?: { id?: string; attributes?: { code?: string; name?: string } }[]
  }
  const data = (json.data || []).map((e) => ({
    id: e?.id,
    code: e?.attributes?.code,
    name: e?.attributes?.name,
  }))

  return res.json({ data })
}
