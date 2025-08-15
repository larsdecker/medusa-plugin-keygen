import { describe, it, expect, vi, beforeEach } from "vitest"
import crypto from "crypto"
import verifyKeygenWebhook from "../middleware/verify-keygen-webhook"

describe("verifyKeygenWebhook", () => {
  beforeEach(() => {
    process.env.KEYGEN_WEBHOOK_SECRET = "test_secret"
  })

  const mockRes = () => {
    const r: any = {}
    r.status = vi.fn().mockReturnValue(r)
    r.json = vi.fn().mockReturnValue(r)
    return r
  }

  it("calls next for valid signature", () => {
    const payload = { foo: "bar" }
    const raw = JSON.stringify(payload)
    const sig = crypto.createHmac("sha256", "test_secret").update(raw).digest("hex")

    const req: any = { headers: { "x-signature": sig }, rawBody: raw }
    const res = mockRes()
    const next = vi.fn()

    verifyKeygenWebhook(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it("rejects invalid signature", () => {
    const payload = { foo: "bar" }
    const raw = JSON.stringify(payload)

    const req: any = { headers: { "x-signature": "bad" }, rawBody: raw }
    const res = mockRes()
    const next = vi.fn()

    verifyKeygenWebhook(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid signature" })
    expect(next).not.toHaveBeenCalled()
  })

  it("fails when raw body is missing", () => {
    const sig = crypto.createHmac("sha256", "test_secret").update("payload").digest("hex")

    const req: any = { headers: { "x-signature": sig } }
    const res = mockRes()
    const next = vi.fn()

    verifyKeygenWebhook(req, res, next)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: "Missing raw body" })
    expect(next).not.toHaveBeenCalled()
  })
})
