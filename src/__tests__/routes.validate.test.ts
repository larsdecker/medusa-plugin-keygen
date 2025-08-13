
import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST as validate } from "../api/admin/keygen/validate/route"

const mockRes = () => {
  const r: any = {}
  r.status = vi.fn().mockReturnValue(r)
  r.json = vi.fn().mockReturnValue(r)
  return r
}

describe("Validate route", () => {
  beforeEach(() => {
    process.env.KEYGEN_ACCOUNT = "acct_123"
    process.env.KEYGEN_TOKEN = "tok_123"
    delete process.env.KEYGEN_HOST
  })

  it("validates a product id", async () => {
    // @ts-ignore
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: "prod_1", attributes: { name: "My Product" } } })
    })

    const req: any = { body: { type: "product", id: "prod_1" } }
    const res: any = mockRes()

    await validate(req, res)
    expect(res.json).toHaveBeenCalledWith({ id: "prod_1", type: "product", name: "My Product" })
  })

  it("uses custom host from env", async () => {
    process.env.KEYGEN_HOST = "https://custom.example.com"
    // @ts-ignore
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: { id: "prod_1", attributes: { name: "A" } } }) })
    const req: any = { body: { type: "product", id: "prod_1" } }
    const res: any = mockRes()
    await validate(req, res)
    expect(global.fetch).toHaveBeenCalledWith(
      "https://custom.example.com/v1/accounts/acct_123/products/prod_1",
      expect.any(Object)
    )
  })
})
