import type { SubscriberArgs } from "@medusajs/medusa"
import type { KeygenPluginOptions } from "../types"

export default async function orderCanceledSubscriber({
  container,
  event,
}: SubscriberArgs<any>) {
  if (event.name !== "order.canceled") return

  const logger = container.resolve("logger")
  const config = container.resolve<any>("configModule")
  const pluginCfg = (config?.plugins || []).find(
    (p: any) => typeof p?.resolve === "string" && p.resolve.includes("medusa-plugin-keygen"),
  )
  const options: KeygenPluginOptions = pluginCfg?.options || {}

  const host = options.host || process.env.KEYGEN_HOST || "https://api.keygen.sh"
  const account = process.env.KEYGEN_ACCOUNT || ""
  const token = process.env.KEYGEN_TOKEN || ""
  const version = process.env.KEYGEN_VERSION || "1.8"
  const timeout = options.timeoutMs ?? 10000

  try {
    const query = container.resolve("query")
    const { data: licenses } = await query.graph({
      entity: "keygen_license",
      filters: { order_id: event.data.id },
      fields: ["id", "keygen_license_id", "order_item_id"],
    })

    for (const lic of licenses ?? []) {
      if (!lic?.keygen_license_id) continue

      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), timeout)

      const res = await fetch(
        `${host}/v1/accounts/${account}/licenses/${lic.keygen_license_id}/actions/suspend`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "Keygen-Version": version,
          },
          signal: controller.signal,
        },
      ).finally(() => clearTimeout(id))

      if (!res.ok) {
        const errText = await res.text().catch(() => "")
        throw new Error(
          `[keygen] suspend license failed: ${res.status} ${res.statusText} ${errText}`,
        )
      }

      await query.graph({
        entity: "keygen_license",
        data: [{ id: lic.id, status: "suspended" }],
      })

      logger.info(
        `[keygen] license suspended for order ${event.data.id} / item ${lic.order_item_id}: ${lic.keygen_license_id}`,
      )
    }
  } catch (e: any) {
    logger.error(`[keygen] failed on order.canceled: ${e?.message}`)
  }
}

