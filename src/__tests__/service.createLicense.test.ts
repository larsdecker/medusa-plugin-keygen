
import { describe, it, expect, vi, beforeEach } from "vitest"
import KeygenService from "../modules/keygen/service"

const container: any = {}

describe("KeygenService.createLicense", () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: { id: "lic_123", attributes: { key: "AAAA-BBBB-CCCC" } }
      })
    })
    process.env.KEYGEN_ACCOUNT = "acct_123"
    process.env.KEYGEN_TOKEN = "tok_123"
  })

  it("creates a license and stores record", async () => {
    const svc = new (KeygenService as any)(container, {})
    // mock repository call
    svc.createKeygenLicenses = vi.fn().mockResolvedValue({
      data: [{
        id: "db_1",
        order_id: "order_1",
        license_key: "AAAA-BBBB-CCCC",
        keygen_license_id: "lic_123",
      }]
    })

    const { record, raw } = await svc.createLicense({
      orderId: "order_1",
      orderItemId: "item_1",
      policyId: "pol_1",
      productId: "prod_1",
      metadata: { foo: "bar" }
    })

    expect(global.fetch).toHaveBeenCalled()
    expect(record.license_key).toBe("AAAA-BBBB-CCCC")
    expect(raw.data.id).toBe("lic_123")
  })
})
