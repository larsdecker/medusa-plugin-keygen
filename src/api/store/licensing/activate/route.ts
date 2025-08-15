import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  SeatsExhaustedError,
  KeygenAuthError,
} from "../../../../modules/keygen/service"

type ReqUser = { id?: string; customer_id?: string }

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const rq = req as MedusaRequest & { user?: ReqUser; auth?: ReqUser }
  const user: ReqUser | undefined = rq.user ?? rq.auth
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

  if (!productId) {
    return res.status(400).json({ message: "productId is required" })
  }
  if (!device?.fingerprint) {
    return res
      .status(400)
      .json({ message: "device.fingerprint is required" })
  }

  const query = req.scope.resolve<{
    graph: (args: unknown) => Promise<{ data?: Record<string, unknown>[] }>
  }>("query")
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

  const keygen = req.scope.resolve<typeof import("../../../../modules/keygen/service").default>(
    "keygenService"
  )

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

    if (e instanceof KeygenAuthError) {
      return res.status(401).json({ message: e.message })
    }

    const message = e instanceof Error ? e.message : "Activation failed"
    return res.status(500).json({ message })
  }
}
