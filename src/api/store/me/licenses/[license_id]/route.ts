import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import KeygenService from '../../../../../modules/keygen/service'

type AuthUser = { id?: string; customer_id?: string }
type LicenseRow = {
  keygen_license_id: string
  license_key: string
  status: string
  keygen_product_id?: string | null
}
type License = {
  id: string
  key: string
  status: string
  product?: { id: string }
  max_machines?: number
  machines?: {
    id?: string
    name?: string | null
    fingerprint?: string | null
    platform?: string | null
  }[]
}

export const GET = async (req: MedusaRequest, res: MedusaResponse<{ license: License } | { message: string }>) => {
  const { user, auth } = req as unknown as {
    user?: AuthUser
    auth?: AuthUser
  }
  const customerId = user?.customer_id ?? user?.id ?? auth?.customer_id ?? auth?.id
  if (!customerId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const licenseId = req.params.license_id

  const query = req.scope.resolve('query') as {
    graph<T>(cfg: Record<string, unknown>): Promise<{ data: T[] | null }>
  }
  const { data } = await query.graph<LicenseRow>({
    entity: 'keygen_license',
    filters: { customer_id: customerId, keygen_license_id: licenseId },
    fields: ['keygen_license_id', 'license_key', 'status', 'keygen_product_id'],
    pagination: { take: 1 },
  })

  const l = data?.[0]
  if (!l) {
    return res.status(404).json({ message: 'License not found' })
  }

  const keygen = req.scope.resolve<KeygenService>('keygenService')
  type LicenseDetails = {
    key?: string | null
    status?: string | null
    maxMachines?: number
    machines?: {
      id?: string
      name?: string | null
      fingerprint?: string | null
      platform?: string | null
    }[]
  }
  let det: LicenseDetails | null = null
  try {
    det = await keygen.getLicenseWithMachines(l.keygen_license_id)
  } catch {
    det = null
  }

  const license: License = {
    id: l.keygen_license_id,
    key: det?.key ?? l.license_key,
    status: det?.status ?? l.status,
    ...(l.keygen_product_id ? { product: { id: l.keygen_product_id } } : {}),
    ...(typeof det?.maxMachines === 'number' ? { max_machines: det.maxMachines } : {}),
    ...(Array.isArray(det?.machines) ? { machines: det.machines } : {}),
  }

  return res.json({ license })
}
