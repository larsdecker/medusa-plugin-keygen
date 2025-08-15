
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

let KeygenService: any
let container: any
let query: any

describe("KeygenService.createLicense", () => {
  beforeEach(async () => {
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
    vi.resetModules()
    KeygenService = (await import("../modules/keygen/service")).default
    query = { graph: vi.fn().mockResolvedValue({ data: [] }) }
    container = {
      resolve(key: string) {
        if (key === "query") {
          return query
        }
        return undefined
      },
    }
  })

  it("creates a license and stores record", async () => {
    query.graph = vi.fn().mockResolvedValue({
      data: [
        {
          id: "db_1",
          order_id: "order_1",
          license_key: "AAAA-BBBB-CCCC",
          keygen_license_id: "lic_123",
        },
      ],
    })

    const svc = new (KeygenService as any)(container, {})

    const { record, raw } = await svc.createLicense({
      orderId: "order_1",
      orderItemId: "item_1",
      policyId: "pol_1",
      productId: "prod_1",
      metadata: { foo: "bar" }
    })

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.keygen.sh/v1/accounts/acct_123/licenses",
      expect.objectContaining({
        headers: expect.objectContaining({ "Keygen-Version": "1.8" })
      })
    )
    expect(record.license_key).toBe("AAAA-BBBB-CCCC")
    expect(raw.data.id).toBe("lic_123")
  })



  it("uses custom host from env", async () => {
    process.env.KEYGEN_HOST = "https://custom.example.com"
    vi.resetModules()
    KeygenService = (await import("../modules/keygen/service")).default
    const svc = new (KeygenService as any)(container, {})
    svc.createKeygenLicenses = vi.fn().mockResolvedValue({ data: [] })
    await svc.createLicense({ orderId: "order_1" })

    expect(global.fetch).toHaveBeenCalledWith(
      "https://custom.example.com/v1/accounts/acct_123/licenses",
      expect.objectContaining({
        headers: expect.objectContaining({ "Keygen-Version": "1.8" })
      })
    )
  })

  it("throws a descriptive error on network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network down"))
    const svc = new (KeygenService as any)(container, {})


      await expect(svc.createLicense({ orderId: "order_1" })).rejects.toThrow(
        "[keygen] create license request failed: Network down"
      )
    })

    it("retries on temporary server error", async () => {
      vi.useFakeTimers()
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "err",
          text: async () => "",
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          statusText: "err",
          text: async () => "",
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: { id: "lic_retry", attributes: { key: "FFFF-GGGG-HHHH" } },
          }),
        })

      query.graph = vi.fn().mockResolvedValue({
        data: [
          {
            id: "db_retry",
            order_id: "order_1",
            license_key: "FFFF-GGGG-HHHH",
            keygen_license_id: "lic_retry",
          },
        ],
      })

      const svc = new (KeygenService as any)(container, {})

      const promise = svc.createLicense({ orderId: "order_1" })
      await vi.runAllTimersAsync()
      const result = await promise

      expect(global.fetch).toHaveBeenCalledTimes(3)
      expect(result.raw.data.id).toBe("lic_retry")
      vi.useRealTimers()
    })
  })
})
