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

  private async fetchWithRetry(
    url: string,
    init: RequestInit,
    maxRetries = 3
  ): Promise<Response> {
    let attempt = 0
    let delay = 100
    while (true) {
      const controller = new AbortController()
      const id = setTimeout(() => controller.abort(), this.timeout)
      try {
        const res = await fetch(url, { ...init, signal: controller.signal })
        if (res.status >= 500 && res.status < 600 && attempt < maxRetries) {
          attempt++
          await new Promise((r) => setTimeout(r, delay))
          delay *= 2
          continue
        }
        return res
      } catch (e) {
        if (attempt < maxRetries) {
          attempt++
          await new Promise((r) => setTimeout(r, delay))
          delay *= 2
          continue
        }
        throw e
      } finally {
        clearTimeout(id)
      }
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

    let res: Response
    try {
      res = await this.fetchWithRetry(
        `${this.host}/v1/accounts/${this.account}/licenses`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "Keygen-Version": this.version,
          },
          body: JSON.stringify(body),
        }
      )
    } catch (e) {
      throw new Error(
        `[keygen] create license request failed: ${e instanceof Error ? e.message : e}`
      )
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
    let res: Response
    try {
      res = await this.fetchWithRetry(
        `${this.host}/v1/accounts/${this.account}/licenses/${licenseId}/actions/suspend`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
            Accept: "application/json",
            "Keygen-Version": this.version,
          },
        }
      )
    } catch (e) {
      throw new Error(
        `[keygen] suspend license request failed: ${
          e instanceof Error ? e.message : e
        }`
      )
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

