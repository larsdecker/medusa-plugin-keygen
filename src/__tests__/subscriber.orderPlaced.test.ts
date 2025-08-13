import { describe, it, expect, vi } from "vitest"

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

import orderPlacedSubscriber from "../subscribers/order-placed"
import { ContainerRegistrationKeys } from "@medusajs/framework"
import KeygenService from "../modules/keygen/service"

const buildContainer = () => {
  const logger = { info: vi.fn(), error: vi.fn() }
  const keygen = { createLicense: vi.fn().mockResolvedValue({ record: { license_key: "AAAA" } }) }
  const order = {
    id: "order_1",
    customer_id: "cust_1",
    items: [
      {
        id: "item_1",
        variant_id: "var_1",
        metadata: { policy: "pol_1", product: "prod_1" },
      },
    ],
  }
  const query = { graph: vi.fn().mockResolvedValue({ data: [order] }) }
  const options = { policyMetadataKey: "policy", productMetadataKey: "product" }
  const config = { plugins: [{ resolve: "medusa-plugin-keygen", options }] }

  const container = {
    resolve(key: string) {
      switch (key) {
        case ContainerRegistrationKeys.LOGGER:
          return logger
        case ContainerRegistrationKeys.CONFIG_MODULE:
          return config
        case ContainerRegistrationKeys.QUERY:
          return query
        case KeygenService.registrationName:
          return keygen
        default:
          return undefined
      }
    },
  }

  return { container, logger, keygen, query }
}

describe("orderPlacedSubscriber", () => {
  it("creates license for items with metadata", async () => {
    const { container, logger, keygen } = buildContainer()
    await orderPlacedSubscriber({
      container: container as any,
      event: { name: "order.placed", data: { id: "order_1" } } as any,
    })
    expect(keygen.createLicense).toHaveBeenCalledWith({
      orderId: "order_1",
      orderItemId: "item_1",
      customerId: "cust_1",
      policyId: "pol_1",
      productId: "prod_1",
      metadata: {
        orderId: "order_1",
        orderItemId: "item_1",
        variantId: "var_1",
      },
    })
    expect(logger.info).toHaveBeenCalledWith(
      `[keygen] license created for order order_1 / item item_1: AAAA`
    )
  })

  it("ignores non order placed events", async () => {
    const { container, keygen, logger } = buildContainer()
    await orderPlacedSubscriber({
      container: container as any,
      event: { name: "order.updated", data: { id: "order_1" } } as any,
    })
    expect(keygen.createLicense).not.toHaveBeenCalled()
    expect(logger.info).not.toHaveBeenCalled()
  })
})
