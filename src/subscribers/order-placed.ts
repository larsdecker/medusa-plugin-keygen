
import type { SubscriberArgs, OrderPlacedPayload } from "@medusajs/medusa"
import { ContainerRegistrationKeys } from "@medusajs/framework"
import KeygenService from "../modules/keygen/service"
import type { KeygenPluginOptions } from "../types"

export default async function orderPlacedSubscriber({
  container,
  event,
}: SubscriberArgs<OrderPlacedPayload>) {
  if (event.name !== "order.placed") return

  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const config = container.resolve<any>(ContainerRegistrationKeys.CONFIG_MODULE)
  const pluginCfg = (config?.plugins || []).find(
    (p: any) => typeof p?.resolve === "string" && p.resolve.includes("medusa-plugin-keygen")
  )
  const options: KeygenPluginOptions = pluginCfg?.options || {}

  const keygen = container.resolve<KeygenService>(KeygenService.registrationName)

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data: orders } = await query.graph({
      entity: "order",
      filters: { id: event.data.id },
      fields: [
        "id",
        "customer_id",
        "metadata",
        "items.*",
        "items.metadata",
        "items.product_id",
        "items.variant_id",
      ],
    })

    const order = orders?.[0]
    if (!order) return

    for (const item of order.items ?? []) {
      const policyId =
        item?.metadata?.[options.policyMetadataKey ?? "keygen_policy"] ??
        options.defaultPolicyId ??
        null
      const productId =
        item?.metadata?.[options.productMetadataKey ?? "keygen_product"] ??
        options.defaultProductId ??
        null

      if (!policyId && !productId) continue

      const { record } = await keygen.createLicense({
        orderId: order.id,
        orderItemId: item.id,
        customerId: order.customer_id ?? null,
        policyId,
        productId,
        metadata: {
          orderId: order.id,
          orderItemId: item.id,
          variantId: item.variant_id,
        },
      })

      logger.info(
        `[keygen] license created for order ${order.id} / item ${item.id}: ${record?.license_key}`
      )
    }
  } catch (e: any) {
    logger.error(`[keygen] failed on order.placed: ${e?.message}`)
  }
}
