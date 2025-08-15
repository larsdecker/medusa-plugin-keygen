import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { customer_id } = req.params as { customer_id: string }
  const query = req.scope.resolve("query")
  const keygen = req.scope.resolve<any>("keygenService")

  const { data } = await query.graph({
    entity: "keygen_license",
    filters: { customer_id },
    fields: [
      "id",
      "license_key",
      "keygen_license_id",
      "status",
      "keygen_policy_id",
      "keygen_product_id",
      "created_at",
    ],
  })

  const licenses = await Promise.all(
    (data ?? []).map(async (l: any) => {
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

  res.json({ licenses })
}
