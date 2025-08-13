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

import orderRefundedSubscriber from "../subscribers/order-refunded"
import { ContainerRegistrationKeys } from "@medusajs/framework"
import KeygenService from "../modules/keygen/service"

const buildContainer = () => {
  const logger = { info: vi.fn(), error: vi.fn() }
  const query = { graph: vi.fn() }
  const keygen = { revokeLicense: vi.fn() }

  const container = {
    resolve(key: string) {
      switch (key) {
        case ContainerRegistrationKeys.LOGGER:
        case "logger":
          return logger
        case ContainerRegistrationKeys.QUERY:
        case "query":
          return query
        case KeygenService.registrationName:
          return keygen
        default:
          return undefined
      }
    },
  }

  return { container, logger, query, keygen }
}

describe("orderRefundedSubscriber", () => {
  beforeEach(() => {
    process.env.KEYGEN_ACCOUNT = "acct_123"
    process.env.KEYGEN_TOKEN = "tok_123"
    delete process.env.KEYGEN_HOST
  })

  it("revokes licenses for refunded order", async () => {
    const { container, logger, query, keygen } = buildContainer()
    query.graph = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          { id: "db_1", keygen_license_id: "lic_1", order_item_id: "item_1" },
        ],
      })
      .mockResolvedValue({ data: [] })

    await orderRefundedSubscriber({
      container: container as any,
      event: { name: "order.refunded", data: { id: "order_1" } } as any,
    })

    expect(keygen.revokeLicense).toHaveBeenCalledWith("lic_1")
    expect(query.graph).toHaveBeenLastCalledWith({
      entity: "keygen_license",
      data: [{ id: "db_1", status: "revoked" }],
    })
    expect(logger.info).toHaveBeenCalledWith(
      "[keygen] license revoked for order order_1 / item item_1: lic_1"
    )
  })

  it("ignores non order refunded events", async () => {
    const { container, logger, keygen } = buildContainer()
    await orderRefundedSubscriber({
      container: container as any,
      event: { name: "order.updated", data: { id: "order_1" } } as any,
    })
    expect(keygen.revokeLicense).not.toHaveBeenCalled()
    expect(logger.info).not.toHaveBeenCalled()
  })
})
