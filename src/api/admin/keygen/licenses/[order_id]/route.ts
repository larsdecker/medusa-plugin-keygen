import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import KeygenService from '../../../../../modules/keygen/service'

// Lists all Keygen licenses for a given order.
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { order_id } = req.params as { order_id: string }
  const query = req.scope.resolve('query')

  const { data } = await query.graph({
    entity: 'keygen_license',
    filters: { order_id },
    fields: [
      'id',
      'order_id',
      'order_item_id',
      'license_key',
      'keygen_license_id',
      'status',
      'keygen_policy_id',
      'keygen_product_id',
      'created_at',
    ],
  })

  res.json({ licenses: data })
}

// Manually issues a new license for the provided order.
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { order_id } = req.params as { order_id: string }
  const keygen = req.scope.resolve<KeygenService>('keygenService')
  const { policyId, productId, orderItemId } = (req.body ?? {}) as {
    policyId?: string
    productId?: string
    orderItemId?: string
  }

  if (!policyId && !productId) {
    return res.status(400).json({ message: 'policyId or productId required' })
  }

  const { record } = await keygen.createLicense({
    orderId: order_id,
    orderItemId,
    policyId,
    productId,
  })

  res.status(201).json({ license: record })
}
