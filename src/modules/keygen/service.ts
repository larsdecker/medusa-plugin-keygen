import type { MedusaContainer } from "@medusajs/framework/types"
import type { KeygenPluginOptions } from "../../types"
import { env } from "../../config/env"

type CreateInput = {
  orderId: string
  orderItemId?: string
  customerId?: string
  policyId?: string | null
  productId?: string | null
  email?: string | null
  metadata?: Record<string, unknown>
}

export class SeatsExhaustedError extends Error {
  code = "SEATS_EXHAUSTED"
  seats: { max: number; used: number }

  constructor(max: number, used: number) {
    super("No free seats available")
    this.seats = { max, used }
  }
}

export class KeygenTimeoutError extends Error {
  constructor(message = "Request timed out") {
    super(message)
    this.name = "KeygenTimeoutError"
  }
}

export class KeygenAuthError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "KeygenAuthError"
  }
}

export class KeygenHttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
    this.name = "KeygenHttpError"
  }
}

interface LicenseAttributes {
  key?: string
  maxMachines?: number
  status?: string | null
  state?: string | null
}

interface LicenseResponse {
  data?: { id?: string; attributes?: LicenseAttributes }
}

interface MachineAttributes {
  name?: string | null
  fingerprint?: string | null
  platform?: string | null
}

interface MachineResponse {
  data?: { id?: string; attributes?: MachineAttributes }
}

interface MachinesResponse {
  data?: Array<{ id?: string; attributes?: MachineAttributes }>
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
    this.account = env.KEYGEN_ACCOUNT
    this.token = env.KEYGEN_TOKEN
    this.timeout = options.timeoutMs ?? 10000
    this.host =
      options.host || env.KEYGEN_HOST
    this.version = env.KEYGEN_VERSION
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
        if (e instanceof Error && e.name === "AbortError") {
          throw new KeygenTimeoutError()
        }
        throw e
      } finally {
        clearTimeout(id)
      }
    }
  }

  private async handleNonOk(
    res: Response,
    context: string
  ): Promise<never> {
    const errText = await res.text().catch(() => "")
    const message = `[keygen] ${context} failed: ${res.status} ${res.statusText} ${errText}`
    if (res.status === 401 || res.status === 403) {
      throw new KeygenAuthError(res.status, message)
    }
    throw new KeygenHttpError(res.status, message)
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
        `[keygen] create license request failed: ${
          e instanceof Error ? e.message : e
        }`
      )
    }

    if (!res.ok) {
      await this.handleNonOk(res, "create license")
    }

    const payload = (await res.json()) as LicenseResponse
    const licenseId = payload?.data?.id
    const key = payload?.data?.attributes?.key || null

    const query = this.container.resolve<{
      graph: (args: unknown) => Promise<{ data?: Record<string, unknown>[] }>
    }>("query")
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

    return { record: data?.[0] as Record<string, unknown>, raw: payload }
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
      await this.handleNonOk(res, "suspend license")
    }

    return (await res.json().catch(() => ({}))) as Record<string, unknown>
  }

  async revokeLicense(licenseId: string) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), this.timeout)

    let res: Response
    try {
      res = await fetch(
        `${this.host}/v1/accounts/${this.account}/licenses/${licenseId}/actions/revoke`,
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
        `[keygen] revoke license request failed: ${
          e instanceof Error ? e.message : e
        }`
      )
    } finally {
      clearTimeout(id)
    }

    if (!res.ok) {
      await this.handleNonOk(res, "revoke license")
    }

    return (await res.json().catch(() => ({}))) as Record<string, unknown>
  }

  async getLicenseWithMachines(licenseId: string) {
    let res = await this.fetchWithRetry(
      `${this.host}/v1/accounts/${this.account}/licenses/${licenseId}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          "Keygen-Version": this.version,
        },
      }
    )

    if (!res.ok) {
      await this.handleNonOk(res, "get license")
    }

    const licensePayload = (await res
      .json()
      .catch(() => ({}))) as LicenseResponse
    const max =
      licensePayload?.data?.attributes?.maxMachines ??
      licensePayload?.maxMachines ??
      0
    const status =
      licensePayload?.data?.attributes?.status ??
      licensePayload?.data?.attributes?.state ??
      null
    const key = licensePayload?.data?.attributes?.key ?? null

    res = await this.fetchWithRetry(
      `${this.host}/v1/accounts/${this.account}/machines?filter[license]=${licenseId}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          "Keygen-Version": this.version,
        },
      }
    )

    if (!res.ok) {
      await this.handleNonOk(res, "list machines")
    }

    const machinesPayload = (await res
      .json()
      .catch(() => ({}))) as MachinesResponse
    const machines = Array.isArray(machinesPayload?.data)
      ? machinesPayload.data.map((m) => ({
          id: m?.id,
          name: m?.attributes?.name ?? null,
          fingerprint: m?.attributes?.fingerprint ?? null,
          platform: m?.attributes?.platform ?? null,
        }))
      : []

    return { id: licenseId, key, status, maxMachines: max, machines }
  }

  async activateMachine(input: {
    licenseId: string
    fingerprint: string
    platform?: string
    name?: string
    meta?: Record<string, unknown>
  }) {
    let res = await this.fetchWithRetry(
      `${this.host}/v1/accounts/${this.account}/licenses/${input.licenseId}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          "Keygen-Version": this.version,
        },
      }
    )

    if (!res.ok) {
      await this.handleNonOk(res, "get license")
    }

    const licensePayload = (await res
      .json()
      .catch(() => ({}))) as LicenseResponse
    const max =
      licensePayload?.data?.attributes?.maxMachines ??
      licensePayload?.maxMachines ??
      0

    res = await this.fetchWithRetry(
      `${this.host}/v1/accounts/${this.account}/machines?filter[license]=${input.licenseId}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          "Keygen-Version": this.version,
        },
      }
    )

    if (!res.ok) {
      await this.handleNonOk(res, "list machines")
    }

    const machinesPayload = (await res
      .json()
      .catch(() => ({}))) as MachinesResponse
    const used = Array.isArray(machinesPayload?.data)
      ? machinesPayload.data.length
      : 0

    if (max > 0 && used >= max) {
      throw new SeatsExhaustedError(max, used)
    }

    const body = {
      data: {
        type: "machines",
        attributes: {
          fingerprint: input.fingerprint,
          ...(input.platform ? { platform: input.platform } : {}),
          ...(input.name ? { name: input.name } : {}),
          ...(input.meta ? { meta: input.meta } : {}),
        },
        relationships: {
          license: { data: { type: "licenses", id: input.licenseId } },
        },
      },
    }

    res = await this.fetchWithRetry(
      `${this.host}/v1/accounts/${this.account}/machines`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
          "Keygen-Version": this.version,
          "Idempotency-Key": `machine_${input.licenseId}_${input.fingerprint}`,
        },
        body: JSON.stringify(body),
      }
    )

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      if (res.status === 409 || res.status === 422) {
        throw new SeatsExhaustedError(max, used)
      }
      await this.handleNonOk(res, "create machine")
    }

    const machinePayload = (await res
      .json()
      .catch(() => ({}))) as MachineResponse
    return {
      machineId: machinePayload?.data?.id,
      seats: { max, used: used + 1 },
      raw: machinePayload,
    }
  }

  async deleteMachine(machineId: string) {
    const res = await this.fetchWithRetry(
      `${this.host}/v1/accounts/${this.account}/machines/${machineId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: "application/json",
          "Keygen-Version": this.version,
        },
      }
    )

    if (!res.ok) {
      await this.handleNonOk(res, "delete machine")
    }

    return (await res.json().catch(() => ({}))) as Record<string, unknown>
  }
}

