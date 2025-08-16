import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import KeygenService from "../../../../../../modules/keygen/service"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { customer_id } = req.params as { customer_id: string }
  const query = req.scope.resolve("query") as {
    graph<T>(cfg: Record<string, unknown>): Promise<{
      data: T[] | null
      metadata?: { count?: number }
    }>
  }
  const keygen = req.scope.resolve<KeygenService>("keygenService")

  const { limit: limitParam, offset: offsetParam, q, order } = (req.query ?? {}) as {
    limit?: string
    offset?: string
    q?: string
    order?: string
  }

  const shouldPaginate =
    typeof limitParam !== "undefined" || typeof offsetParam !== "undefined"

  const take = shouldPaginate ? parseInt(limitParam ?? "20", 10) : undefined
  const skip = shouldPaginate ? parseInt(offsetParam ?? "0", 10) : undefined

  let orderBy: Record<string, "asc" | "desc"> | undefined
  if (order) {
    const [field, direction] = order.split(":")
    orderBy = { [field]: (direction as "asc" | "desc") ?? "asc" }
  }

  const { data, metadata } = await query.graph<LicenseRow>({
    entity: "keygen_license",
    filters: { customer_id, ...(q ? { q } : {}) },
    fields: [
      "id",
      "license_key",
      "keygen_license_id",
      "status",
      "keygen_policy_id",
      "keygen_product_id",
      "created_at",
    ],
    ...(shouldPaginate ? { pagination: { take, skip } } : {}),
    ...(orderBy ? { orderBy } : {}),
  })

  type LicenseRow = {
    id?: string
    license_key: string
    keygen_license_id?: string
    status: string
    keygen_policy_id?: string | null
    keygen_product_id?: string | null
  }

  const licenses = await Promise.all(
    (data ?? []).map(async (l: LicenseRow) => {
      if (!l.keygen_license_id) {
        return { ...l, machines: [], max_machines: 0 }
      }
      try {
        const det = await keygen.getLicenseWithMachines(l.keygen_license_id)
        return {
          id: l.keygen_license_id,
          key: l.license_key,
          status: det.status ?? l.status,
          policy_id: l.keygen_policy_id,
          product_id: l.keygen_product_id,
          max_machines: det.maxMachines,
          machines: det.machines,
        }
      } catch (e) {
        return {
          id: l.keygen_license_id,
          key: l.license_key,
          status: l.status,
          policy_id: l.keygen_policy_id,
          product_id: l.keygen_product_id,
          max_machines: 0,
          machines: [],
        }
      }
    })
  )

  if (shouldPaginate) {
    const count = metadata?.count ?? (data?.length ?? 0) + (skip ?? 0)
    return res.json({ licenses, count, limit: take!, offset: skip! })
  }

  res.json({ licenses })
}
