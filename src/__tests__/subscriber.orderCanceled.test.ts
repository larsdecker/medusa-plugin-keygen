import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@medusajs/framework", () => ({
  MedusaService: () => class {},
  ContainerRegistrationKeys: {
    LOGGER: "logger",
    CONFIG_MODULE: "config",
    QUERY: "query",
  },
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

import orderCanceledSubscriber from "../subscribers/order-canceled"
import { ContainerRegistrationKeys } from "@medusajs/framework"

const buildContainer = () => {
  const logger = { info: vi.fn(), error: vi.fn() }
  const query = { graph: vi.fn() }
  const config = { plugins: [{ resolve: "medusa-plugin-keygen", options: {} }] }

  const container = {
    resolve(key: string) {
      switch (key) {
        case ContainerRegistrationKeys.LOGGER:
          return logger
        case ContainerRegistrationKeys.CONFIG_MODULE:
        case "configModule":
          return config
        case ContainerRegistrationKeys.QUERY:
          return query
        default:
          return undefined
      }
    },
  }

  return { container, logger, query }
}

describe("orderCanceledSubscriber", () => {
  beforeEach(() => {
    // @ts-ignore
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
    process.env.KEYGEN_ACCOUNT = "acct_123"
    process.env.KEYGEN_TOKEN = "tok_123"
    delete process.env.KEYGEN_HOST
  })

  it("suspends licenses for canceled order", async () => {
    const { container, logger, query } = buildContainer()
    query.graph = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          { id: "db_1", keygen_license_id: "lic_1", order_item_id: "item_1" },
        ],
      })
      .mockResolvedValue({ data: [] })

    await orderCanceledSubscriber({
      container: container as any,
      event: { name: "order.canceled", data: { id: "order_1" } } as any,
    })

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.keygen.sh/v1/accounts/acct_123/licenses/lic_1/actions/suspend",
      expect.objectContaining({ method: "POST" })
    )
    expect(query.graph).toHaveBeenLastCalledWith({
      entity: "keygen_license",
      data: [{ id: "db_1", status: "suspended" }],
    })
    expect(logger.info).toHaveBeenCalledWith(
      "[keygen] license suspended for order order_1 / item item_1: lic_1"
    )
  })

  it("ignores non order canceled events", async () => {
    const { container, logger } = buildContainer()
    await orderCanceledSubscriber({
      container: container as any,
      event: { name: "order.updated", data: { id: "order_1" } } as any,
    })
    expect(global.fetch).not.toHaveBeenCalled()
    expect(logger.info).not.toHaveBeenCalled()
  })
})

