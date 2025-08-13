import type { SubscriberArgs } from "@medusajs/medusa"
import KeygenService from "../modules/keygen/service"

export default async function orderRefundedSubscriber({
  container,
  event,
}: SubscriberArgs<any>) {
  if (event.name !== "order.refunded") return

  const logger = container.resolve("logger")
  const keygen = container.resolve<KeygenService>(KeygenService.registrationName)

  try {
    const query = container.resolve("query")
    const { data: licenses } = await query.graph({
      entity: "keygen_license",
      filters: { order_id: event.data.id },
      fields: ["id", "keygen_license_id", "order_item_id"],
    })

    for (const lic of licenses ?? []) {
      if (!lic?.keygen_license_id) continue

      await keygen.revokeLicense(lic.keygen_license_id)

      await query.graph({
        entity: "keygen_license",
        data: [{ id: lic.id, status: "revoked" }],
      })

      logger.info(
        `[keygen] license revoked for order ${event.data.id} / item ${lic.order_item_id}: ${lic.keygen_license_id}`,
      )
    }
  } catch (e: any) {
    logger.error(`[keygen] failed on order.refunded: ${e?.message}`)
  }
}
