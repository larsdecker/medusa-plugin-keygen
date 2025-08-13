
import { describe, it, expect, vi, beforeEach } from "vitest"
import { POST as createPolicy } from "../api/admin/keygen/policies/route"
import { POST as clonePolicy } from "../api/admin/keygen/policies/clone/route"

const mockRes = () => {
  const r: any = {}
  r.status = vi.fn().mockReturnValue(r)
  r.json = vi.fn().mockReturnValue(r)
  return r
}

describe("Policies routes", () => {
  beforeEach(() => {
    process.env.KEYGEN_ACCOUNT = "acct_123"
    process.env.KEYGEN_TOKEN = "tok_123"
  })

  it("creates a policy", async () => {
    // @ts-ignore
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { id: "pol_new", attributes: { name: "Annual – 2 Seats" } } })
    })

    const req: any = { body: { productId: "prod_1", name: "Annual – 2 Seats", maxMachines: 2 } }
    const res: any = mockRes()

    await createPolicy(req, res)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ id: "pol_new", name: "Annual – 2 Seats" })
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.keygen.sh/v1/accounts/acct_123/policies",
      expect.objectContaining({
        headers: expect.objectContaining({ "Keygen-Version": "1.8" })
      })
    )
  })

  it("clones a policy", async () => {
    ;(global as any).fetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: "pol_src", attributes: { name: "Src", maxMachines: 2 } } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { id: "pol_cloned" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })

    const req: any = { body: { sourcePolicyId: "pol_src", targetProductId: "prod_2" } }
    const res: any = mockRes()

    await clonePolicy(req, res)
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ id: "pol_cloned" })
    expect((global as any).fetch).toHaveBeenNthCalledWith(
      1,
      "https://api.keygen.sh/v1/accounts/acct_123/policies/pol_src",
      expect.objectContaining({ headers: expect.objectContaining({ "Keygen-Version": "1.8" }) })
    )
    expect((global as any).fetch).toHaveBeenNthCalledWith(
      2,
      "https://api.keygen.sh/v1/accounts/acct_123/policies",
      expect.objectContaining({ headers: expect.objectContaining({ "Keygen-Version": "1.8" }) })
    )
    expect((global as any).fetch).toHaveBeenNthCalledWith(
      3,
      "https://api.keygen.sh/v1/accounts/acct_123/policies/pol_src/entitlements",
      expect.objectContaining({ headers: expect.objectContaining({ "Keygen-Version": "1.8" }) })
    )
  })
})
