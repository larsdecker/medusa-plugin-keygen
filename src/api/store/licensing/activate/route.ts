import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SeatsExhaustedError } from "../../../../modules/keygen/service"
import KeygenService from "../../../../modules/keygen/service"

type AuthenticatedRequest = MedusaRequest & {
  user?: { id?: string; customer_id?: string }
  auth?: { id?: string; customer_id?: string }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const authReq = req as AuthenticatedRequest
  const user = authReq.user || authReq.auth
  const customerId = user?.customer_id || user?.id

  if (!customerId) {
    return res.status(401).json({ message: "Unauthorized" })
  }

  const { productId, device } = (req.body ?? {}) as {
    productId?: string
    device?: {
      fingerprint?: string
      platform?: string
      appVersion?: string
      name?: string
    }
  }

  if (!productId || !device?.fingerprint) {
    return res
      .status(400)
      .json({ message: "productId and device.fingerprint are required" })
  }

  const query = req.scope.resolve("query")
  const { data } = await query.graph({
    entity: "keygen_license",
    filters: { customer_id: customerId, keygen_product_id: productId },
    fields: ["keygen_license_id"],
    pagination: { take: 1 },
  })

  const license = data?.[0]
  if (!license?.keygen_license_id) {
    return res.status(404).json({ message: "License not found" })
  }

  const keygen = req.scope.resolve<KeygenService>("keygenService")

  try {
    const result = await keygen.activateMachine({
      licenseId: license.keygen_license_id,
      fingerprint: device.fingerprint!,
      platform: device.platform,
      meta: { appVersion: device.appVersion },
    })

    return res.json({
      status: "ACTIVATED",
      licenseId: license.keygen_license_id,
      machineId: result.machineId,
      seats: result.seats,
    })
  } catch (e: unknown) {
    if (e instanceof SeatsExhaustedError) {
      return res.status(409).json({
        status: "DENIED",
        code: "SEATS_EXHAUSTED",
        message:
          "Keine freien Geräteplätze auf dieser Lizenz. Bitte entfernen Sie ein Gerät im Kundenkonto oder kontaktieren Sie den Support.",
        seats: e.seats,
      })
    }

    const message = e instanceof Error ? e.message : "Activation failed"
    return res.status(500).json({ message })
  }
}
