import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

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
}

export const GET = async (
  req: MedusaRequest,
  res: MedusaResponse<
    | { licenses: License[] }
    | { licenses: License[]; count: number; limit: number; offset: number }
    | { message: string }
  >
) => {
  const { user, auth } = req as unknown as {
    user?: AuthUser
    auth?: AuthUser
  }
  const customerId =
    user?.customer_id ?? user?.id ?? auth?.customer_id ?? auth?.id

  if (!customerId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const query = req.scope.resolve("query") as {
    graph<T>(cfg: any): Promise<{ data: T[] | null; metadata?: { count?: number } }>
  }

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

  const cfg: any = {
    entity: "keygen_license",
    filters: { customer_id: customerId, ...(q ? { q } : {}) },
    fields: [
      "keygen_license_id",
      "license_key",
      "status",
      "keygen_product_id",
    ],
    ...(shouldPaginate ? { pagination: { take, skip } } : {}),
    ...(orderBy ? { orderBy } : {}),
  }

  const { data, metadata } = await query.graph<LicenseRow>(cfg)

  const licenses: License[] = (data ?? []).map((l) => ({
    id: l.keygen_license_id,
    key: l.license_key,
    status: l.status,
    ...(l.keygen_product_id
      ? { product: { id: l.keygen_product_id } }
      : {}),
  }))

  if (shouldPaginate) {
    const count = metadata?.count ?? (data?.length ?? 0) + (skip ?? 0)
    return res.json({ licenses, count, limit: take!, offset: skip! })
  }

  return res.json({ licenses })
}
