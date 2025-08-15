
import type { SubscriberArgs } from "@medusajs/medusa"
import KeygenService, {
  KeygenAuthError,
  SeatsExhaustedError,
} from "../modules/keygen/service"
import type { KeygenPluginOptions } from "../types"

interface OrderItem {
  id: string
  variant_id?: string
  metadata?: Record<string, unknown>
}

interface Order {
  id: string
  customer_id?: string
  items?: OrderItem[]
}

interface PluginConfig {
  plugins?: { resolve?: string; options?: KeygenPluginOptions }[]
}

export default async function orderPlacedSubscriber({
  container,
  event,
}: SubscriberArgs<{ id: string }>) {
  if (event.name !== "order.placed") return

  const logger = container.resolve("logger")
  const config = container.resolve<PluginConfig>("configModule")
  const pluginCfg = (config?.plugins || []).find(
    (p) => typeof p?.resolve === "string" && p.resolve.includes("medusa-plugin-keygen")
  )
  const options: KeygenPluginOptions = pluginCfg?.options || {}

  const keygen = container.resolve<KeygenService>(KeygenService.registrationName)

  try {
    const query = container.resolve<{
      graph: (args: unknown) => Promise<{ data?: Order[] }>
    }>("query")
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
  } catch (e: unknown) {
    if (e instanceof SeatsExhaustedError) {
      logger.error(`[keygen] seats exhausted for order ${event.data.id}`)
    } else if (e instanceof KeygenAuthError) {
      logger.error(`[keygen] auth error on order.placed: ${e.message}`)
    } else if (e instanceof Error) {
      logger.error(`[keygen] failed on order.placed: ${e.message}`)
    } else {
      logger.error(`[keygen] failed on order.placed: ${String(e)}`)
    }
  }
}
