
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { order_id } = req.params as { order_id: string }
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph({
    entity: "keygen_license",
    filters: { order_id },
    fields: [
      "id",
      "order_id",
      "order_item_id",
      "license_key",
      "keygen_license_id",
      "status",
      "keygen_policy_id",
      "keygen_product_id",
      "created_at",
    ],
  })

  res.json({ licenses: data })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { order_id } = req.params as { order_id: string }
  const keygen = req.scope.resolve<any>("keygenService")
  const { policyId, productId, orderItemId } = (req.body ?? {}) as {
    policyId?: string
    productId?: string
    orderItemId?: string
  }

  const { record } = await keygen.createLicense({
    orderId: order_id,
    orderItemId,
    policyId,
    productId,
  })

  res.status(201).json({ license: record })
}
