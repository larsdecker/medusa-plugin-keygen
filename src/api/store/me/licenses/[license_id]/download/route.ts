import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import KeygenService, { DownloadLink } from '../../../../../../modules/keygen/service'

type AuthUser = { id?: string; customer_id?: string }
interface DownloadBody {
  assetId: string
  filename?: string
}

export const POST = async (
  req: MedusaRequest,
  res: MedusaResponse<{ link: DownloadLink; licenseId: string; assetId: string } | { message: string }>,
) => {
  const { user, auth } = req as unknown as {
    user?: AuthUser
    auth?: AuthUser
  }
  const customerId = user?.customer_id ?? user?.id ?? auth?.customer_id ?? auth?.id
  if (!customerId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const licenseId = req.params.license_id
  const body = req.body as DownloadBody | undefined
  const { assetId, filename } = body || {}

  if (!assetId) {
    return res.status(400).json({ message: 'assetId is required' })
  }

  const query = req.scope.resolve('query') as {
    graph<T>(cfg: Record<string, unknown>): Promise<{ data: T[] | null }>
  }
  const { data } = await query.graph<{ keygen_license_id: string }>({
    entity: 'keygen_license',
    filters: { customer_id: customerId, keygen_license_id: licenseId },
    fields: ['keygen_license_id'],
    pagination: { take: 1 },
  })

  const license = data?.[0]
  if (!license) {
    return res.status(404).json({ message: 'License not found' })
  }

  const keygen = req.scope.resolve<KeygenService>('keygenService')
  try {
    const link = await keygen.createDownloadLink({
      licenseId: licenseId,
      assetId,
      filename,
    })

    return res.status(201).json({ link, licenseId, assetId })
  } catch (e) {
    const msg = e instanceof Error ? e.message : undefined
    return res.status(500).json({ message: msg || 'Could not create download link' })
  }
}
