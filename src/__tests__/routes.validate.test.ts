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
  })

  it("validates a product id", async () => {
    // @ts-ignore
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: "prod_1", attributes: { name: "My Product" } },
      }),
    })

    const req: any = { body: { type: "product", id: "prod_1" } }
    const res: any = mockRes()

    await validate(req, res)
    expect(res.json).toHaveBeenCalledWith({
      id: "prod_1",
      type: "product",
      name: "My Product",
    })
  })
})
