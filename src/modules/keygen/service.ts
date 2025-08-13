import type { MedusaContainer } from "@medusajs/framework/types"
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

export default class KeygenService {
  static readonly registrationName = "keygenService"
  private account: string
  private token: string
  private timeout: number
  private host: string
  private version: string
  private options: KeygenPluginOptions

  constructor(
    protected readonly container: MedusaContainer,
    options: KeygenPluginOptions = {}
  ) {
    this.options = options
    this.account = process.env.KEYGEN_ACCOUNT || ""
    this.token = process.env.KEYGEN_TOKEN || ""
    this.timeout = options.timeoutMs ?? 10000
    this.host =
      options.host || process.env.KEYGEN_HOST || "https://api.keygen.sh"
    this.version = process.env.KEYGEN_VERSION || "1.8"
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

    let res: Response
    try {
      res = await fetch(`${this.host}/v1/accounts/${this.account}/licenses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Keygen-Version": this.version,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } catch (e) {
      throw new Error(
        `[keygen] create license request failed: ${e instanceof Error ? e.message : e}`
      )
    } finally {
      clearTimeout(id)
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      throw new Error(
        `[keygen] create license failed: ${res.status} ${res.statusText} ${errText}`
      )
    }

    const payload = (await res.json()) as any
    const licenseId = payload?.data?.id
    const key = payload?.data?.attributes?.key || null

    const query = this.container.resolve<any>("query")
    const { data } = await query.graph({
      entity: "keygen_license",
      data: [
        {
          order_id: input.orderId,
          order_item_id: input.orderItemId ?? null,
          customer_id: input.customerId ?? null,
          keygen_license_id: licenseId,
          license_key: key,
          status: "created",
          keygen_policy_id: input.policyId ?? null,
          keygen_product_id: input.productId ?? null,
        },
      ],
    })

    return { record: data?.[0], raw: payload }
  }

  async suspendLicense(licenseId: string) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), this.timeout)

    let res: Response
    try {
      res = await fetch(
        `${this.host}/v1/accounts/${this.account}/licenses/${licenseId}/actions/suspend`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "Keygen-Version": this.version,
          },
          signal: controller.signal,
        }
      )
    } catch (e) {
      throw new Error(
        `[keygen] suspend license request failed: ${
          e instanceof Error ? e.message : e
        }`
      )
    } finally {
      clearTimeout(id)
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      throw new Error(
        `[keygen] suspend license failed: ${res.status} ${res.statusText} ${errText}`
      )
    }

    return (await res.json().catch(() => ({}))) as any
  }
}

