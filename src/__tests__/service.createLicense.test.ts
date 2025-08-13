
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@medusajs/framework", () => ({
  MedusaService: () => class {},
  ContainerRegistrationKeys: {},
}))

vi.mock("@medusajs/framework/utils", () => {
  const chain = () => ({
    index: () => chain(),
    nullable: () => chain(),
    searchable: () => chain(),
    primaryKey: () => chain(),
    default: () => chain(),
  })
  return { model: { define: vi.fn(() => ({})), text: chain, id: chain, enum: chain } }
})

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
    delete process.env.KEYGEN_HOST
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

  it("uses custom host from env", async () => {
    process.env.KEYGEN_HOST = "https://custom.example.com"
    const svc = new (KeygenService as any)(container, {})
    svc.createKeygenLicenses = vi.fn().mockResolvedValue({ data: [] })

    await svc.createLicense({ orderId: "order_1" })

    expect(global.fetch).toHaveBeenCalledWith(
      "https://custom.example.com/v1/accounts/acct_123/licenses",
      expect.any(Object)
    )
  })
})
