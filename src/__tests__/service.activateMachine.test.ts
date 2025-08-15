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

describe("KeygenService.activateMachine", () => {
  beforeEach(async () => {
    process.env.KEYGEN_ACCOUNT = "acct_123"
    process.env.KEYGEN_TOKEN = "tok_123"
    delete process.env.KEYGEN_HOST
    vi.resetModules()
    KeygenService = (await import("../modules/keygen/service")).default
    container = { resolve: () => ({}) }
  })

  it("registers a machine when a seat is free", async () => {
    // license
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "lic_1", attributes: { maxMachines: 3 } } }),
      })
      // machines list
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: "mac_1" }, { id: "mac_2" }] }),
      })
      // machine create
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "mac_new" } }),
      })
    // @ts-ignore
    global.fetch = fetchMock

    const svc = new KeygenService(container, {})
    const result = await svc.activateMachine({
      licenseId: "lic_1",
      fingerprint: "fp_123",
    })

    expect(result.machineId).toBe("mac_new")
    expect(result.seats).toEqual({ max: 3, used: 3 })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("throws SeatsExhaustedError when no seats left", async () => {
    const fetchMock = vi.fn()
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: { id: "lic_1", attributes: { maxMachines: 2 } } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: "mac_1" }, { id: "mac_2" }] }),
      })
    // @ts-ignore
    global.fetch = fetchMock

    const svc = new KeygenService(container, {})
    await expect(
      svc.activateMachine({ licenseId: "lic_1", fingerprint: "fp" })
    ).rejects.toMatchObject({ code: "SEATS_EXHAUSTED" })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

