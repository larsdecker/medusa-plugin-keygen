
import type { LoaderOptions } from "@medusajs/framework/types"
import KeygenService from "./modules/keygen/service"
import orderPlacedSubscriber from "./subscribers/order-placed"
import orderCanceledSubscriber from "./subscribers/order-canceled"
import orderRefundedSubscriber from "./subscribers/order-refunded"

export default async function keygenPlugin(_: LoaderOptions) {
  return {
    services: [KeygenService],
    subscribers: [
      orderPlacedSubscriber,
      orderCanceledSubscriber,
      orderRefundedSubscriber,
    ],
  }
}
