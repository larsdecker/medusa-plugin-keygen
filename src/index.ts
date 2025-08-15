
import type { LoaderOptions } from "@medusajs/framework/types"
import KeygenService from "./modules/keygen/service"
import orderPlacedSubscriber from "./subscribers/order-placed"
import orderCanceledSubscriber from "./subscribers/order-canceled"
import orderRefundedSubscriber from "./subscribers/order-refunded"

type Subscriber = (...args: unknown[]) => unknown

export default async function keygenPlugin(
  _: LoaderOptions
): Promise<{
  services: typeof KeygenService[]
  subscribers: Subscriber[]
}> {
  return {
    services: [KeygenService],
    subscribers: [
      orderPlacedSubscriber,
      orderCanceledSubscriber,
      orderRefundedSubscriber,
    ],
  }
}
