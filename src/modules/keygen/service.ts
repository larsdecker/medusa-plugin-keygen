
import { MedusaService } from "@medusajs/framework"
import type { MedusaContainer } from "@medusajs/framework/types"
import KeygenLicense from "./models/license"
import type { KeygenPluginOptions } from "../../types"

type CreateInput = {
  orderId: string
  orderItemId?: string
  customerId?: string
  policyId?: string | null
  productId?: string | null
  email?: string | null
  metadata?: Record<string, unknown>
}

export default class KeygenService extends MedusaService({ KeygenLicense }) {
  static readonly registrationName = "keygenService"
  private account: string
  private token: string
  private timeout: number
  private options: KeygenPluginOptions

  constructor(
    protected readonly container: MedusaContainer,
    options: KeygenPluginOptions = {}
  ) {
    // @ts-ignore MedusaService factory expands constructor
    super(...arguments)
    this.options = options
    this.account = process.env.KEYGEN_ACCOUNT || ""
    this.token = process.env.KEYGEN_TOKEN || ""
    this.timeout = options.timeoutMs ?? 10000
    if (!this.account || !this.token) {
      console.warn("[keygen] Missing KEYGEN_ACCOUNT or KEYGEN_TOKEN")
    }
  }

  async createLicense(input: CreateInput) {
    const body = {
      data: {
        type: "licenses",
        attributes: {
          ...(input.metadata ? { metadata: input.metadata } : {}),
        },
        relationships: {
          ...(input.policyId
            ? { policy: { data: { type: "policies", id: input.policyId } } }
            : {}),
          ...(input.productId
            ? { product: { data: { type: "products", id: input.productId } } }
            : {}),
        },
      },
    }

    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), this.timeout)

    const res = await fetch(
      `https://api.keygen.sh/v1/accounts/${this.account}/licenses`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    ).finally(() => clearTimeout(id))

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      throw new Error(
        `[keygen] create license failed: ${res.status} ${res.statusText} ${errText}`
      )
    }

    const payload = (await res.json()) as any
    const licenseId = payload?.data?.id
    const key = payload?.data?.attributes?.key || null

    // @ts-ignore generated repository via factory
    const { data } = await this.createKeygenLicenses({
      data: {
        order_id: input.orderId,
        order_item_id: input.orderItemId ?? null,
        customer_id: input.customerId ?? null,
        keygen_license_id: licenseId,
        license_key: key,
        status: "created",
        keygen_policy_id: input.policyId ?? null,
        keygen_product_id: input.productId ?? null,
      },
    })

    return { record: data[0], raw: payload }
  }
}
