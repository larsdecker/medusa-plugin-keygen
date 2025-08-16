import type { SubscriberArgs } from "@medusajs/medusa"
import KeygenService from "../modules/keygen/service"

export default async function orderCanceledSubscriber({
  container,
  event,
}: SubscriberArgs<{ id: string }>) {
  if (event.name !== "order.canceled") return

  const logger = container.resolve("logger")
  const keygen = container.resolve<KeygenService>(KeygenService.registrationName)

  try {
    const query = container.resolve("query") as {
      graph<T>(cfg: Record<string, unknown>): Promise<{ data: T[] | null }>
    }
    const { data: licenses } = await query.graph<{ id: string; keygen_license_id?: string; order_item_id?: string }>({
      entity: "keygen_license",
      filters: { order_id: event.data.id },
      fields: ["id", "keygen_license_id", "order_item_id"],
    })

    for (const lic of licenses ?? []) {
      if (!lic?.keygen_license_id) continue

      await keygen.suspendLicense(lic.keygen_license_id)

      await query.graph({
        entity: "keygen_license",
        data: [{ id: lic.id, status: "suspended" }],
      })

      logger.info(
        `[keygen] license suspended for order ${event.data.id} / item ${lic.order_item_id}: ${lic.keygen_license_id}`,
      )
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error(`[keygen] failed on order.canceled: ${msg}`)
  }
}

