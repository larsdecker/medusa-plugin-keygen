import type { MedusaContainer } from '@medusajs/framework/types'
import type { KeygenPluginOptions } from '../../types'
import { env } from '../../config/env'

type CreateInput = {
  orderId: string
  orderItemId?: string
  customerId?: string
  policyId?: string | null
  productId?: string | null
  email?: string | null
  metadata?: Record<string, unknown>
}

export interface DownloadLink {
  url: string
  expiresAt: string
  ttlSeconds: number
  contentDisposition?: string
}

export interface CreateDownloadLinkInput {
  licenseId: string
  assetId: string
  filename?: string
}

type CachedLink = {
  url: string
  expiresAt: number
  ttlSeconds: number
  contentDisposition?: string
}

interface KeygenRecord<Attr = Record<string, unknown>> {
  id?: string
  attributes?: Attr
}

interface KeygenResponse<T> {
  data?: T
}

interface LicenseAttributes {
  key?: string | null
  maxMachines?: number
  status?: string | null
  state?: string | null
}

type LicensePayload = KeygenRecord<LicenseAttributes>

type LicenseResponse = KeygenResponse<LicensePayload> & { maxMachines?: number }

interface KeygenLicenseRecord {
  license_key?: string
  [k: string]: unknown
}

interface MachineAttributes {
  name?: string | null
  fingerprint?: string | null
  platform?: string | null
}

type MachinePayload = KeygenRecord<MachineAttributes>

type MachinesResponse = KeygenResponse<MachinePayload[]>

interface QueryClient {
  graph<T>(cfg: Record<string, unknown>): Promise<{ data: T[] }>
}

export class SeatsExhaustedError extends Error {
  code = 'SEATS_EXHAUSTED'
  seats: { max: number; used: number }

  constructor(max: number, used: number) {
    super('No free seats available')
    this.seats = { max, used }
  }
}

/**
 * Service wrapping interactions with the Keygen licensing API.
 * It handles license lifecycle operations such as creation,
 * suspension and machine activation.
 */
export default class KeygenService {
  static readonly registrationName = 'keygenService'
  private account: string
  private token: string
  private timeout: number
  private host: string
  private version: string
  private options: KeygenPluginOptions
  private downloadCache = new Map<string, CachedLink>()

  constructor(
    protected readonly container: MedusaContainer,
    options: KeygenPluginOptions = {},
  ) {
    this.options = options
    this.account = env.KEYGEN_ACCOUNT
    this.token = env.KEYGEN_TOKEN
    this.timeout = options.timeoutMs ?? 10000
    this.host = options.host || env.KEYGEN_HOST
    this.version = env.KEYGEN_VERSION
  }

  /**
   * Execute a fetch request with simple exponential backoff for 5xx errors.
   */
  private async fetchWithRetry(url: string, init: RequestInit, maxRetries = 3): Promise<Response> {
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

  /**
   * Creates a new license in Keygen and persists a copy in the local
   * `keygen_license` table.
   */
  async createLicense(
    input: CreateInput,
  ): Promise<{ record: KeygenLicenseRecord | undefined; raw: KeygenResponse<LicensePayload> }> {
    const body = {
      data: {
        type: 'licenses',
        attributes: {
          ...(input.metadata ? { metadata: input.metadata } : {}),
        },
        relationships: {
          ...(input.policyId ? { policy: { data: { type: 'policies', id: input.policyId } } } : {}),
          ...(input.productId ? { product: { data: { type: 'products', id: input.productId } } } : {}),
        },
      },
    }

    let res: Response
    try {
      res = await this.fetchWithRetry(`${this.host}/v1/accounts/${this.account}/licenses`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Keygen-Version': this.version,
        },
        body: JSON.stringify(body),
      })
    } catch (e) {
      throw new Error(`[keygen] create license request failed: ${e instanceof Error ? e.message : e}`)
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`[keygen] create license failed: ${res.status} ${res.statusText} ${errText}`)
    }

    const payload = (await res.json()) as KeygenResponse<LicensePayload>
    const licenseId = payload?.data?.id
    const key = payload?.data?.attributes?.key || null

    const query = this.container.resolve<QueryClient>('query')
    const { data } = await query.graph<KeygenLicenseRecord>({
      entity: 'keygen_license',
      data: [
        {
          order_id: input.orderId,
          order_item_id: input.orderItemId ?? null,
          customer_id: input.customerId ?? null,
          keygen_license_id: licenseId,
          license_key: key,
          status: 'created',
          keygen_policy_id: input.policyId ?? null,
          keygen_product_id: input.productId ?? null,
        },
      ],
    })

    return { record: data?.[0], raw: payload }
  }

  /**
   * Marks a license as suspended in Keygen.
   * Typically used when an order is cancelled.
   */
  async suspendLicense(licenseId: string) {
    let res: Response
    try {
      res = await this.fetchWithRetry(
        `${this.host}/v1/accounts/${this.account}/licenses/${licenseId}/actions/suspend`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Keygen-Version': this.version,
          },
        },
      )
    } catch (e) {
      throw new Error(`[keygen] suspend license request failed: ${e instanceof Error ? e.message : e}`)
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`[keygen] suspend license failed: ${res.status} ${res.statusText} ${errText}`)
    }

    return (await res.json().catch(() => ({}))) as Record<string, unknown>
  }

  /**
   * Permanently revokes a license in Keygen.
   * Called when an order is refunded.
   */
  async revokeLicense(licenseId: string) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), this.timeout)

    let res: Response
    try {
      res = await fetch(`${this.host}/v1/accounts/${this.account}/licenses/${licenseId}/actions/revoke`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Keygen-Version': this.version,
        },
        signal: controller.signal,
      })
    } catch (e) {
      throw new Error(`[keygen] revoke license request failed: ${e instanceof Error ? e.message : e}`)
    } finally {
      clearTimeout(id)
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`[keygen] revoke license failed: ${res.status} ${res.statusText} ${errText}`)
    }

    return (await res.json().catch(() => ({}))) as Record<string, unknown>
  }

  /**
   * Retrieves a license and its associated machines from Keygen.
   */
  async getLicenseWithMachines(licenseId: string) {
    let res = await this.fetchWithRetry(`${this.host}/v1/accounts/${this.account}/licenses/${licenseId}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        'Keygen-Version': this.version,
      },
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`[keygen] get license failed: ${res.status} ${res.statusText} ${errText}`)
    }

    const licensePayload = (await res.json().catch(() => ({}))) as LicenseResponse
    const max = licensePayload?.data?.attributes?.maxMachines ?? licensePayload?.maxMachines ?? 0
    const status = licensePayload?.data?.attributes?.status ?? licensePayload?.data?.attributes?.state ?? null
    const key = licensePayload?.data?.attributes?.key ?? null

    res = await this.fetchWithRetry(`${this.host}/v1/accounts/${this.account}/machines?filter[license]=${licenseId}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        'Keygen-Version': this.version,
      },
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`[keygen] list machines failed: ${res.status} ${res.statusText} ${errText}`)
    }

    const machinesPayload = (await res.json().catch(() => ({}))) as MachinesResponse
    const machines = Array.isArray(machinesPayload?.data)
      ? machinesPayload.data.map((m: MachinePayload) => ({
          id: m?.id,
          name: m?.attributes?.name ?? null,
          fingerprint: m?.attributes?.fingerprint ?? null,
          platform: m?.attributes?.platform ?? null,
        }))
      : []

    return { id: licenseId, key, status, maxMachines: max, machines }
  }

  /**
   * Activates a new machine for the given license. Throws when no seats
   * are available.
   */
  async activateMachine(input: {
    licenseId: string
    fingerprint: string
    platform?: string
    name?: string
    meta?: Record<string, unknown>
  }) {
    let res = await this.fetchWithRetry(`${this.host}/v1/accounts/${this.account}/licenses/${input.licenseId}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        'Keygen-Version': this.version,
      },
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`[keygen] get license failed: ${res.status} ${res.statusText} ${errText}`)
    }

    const licensePayload = (await res.json().catch(() => ({}))) as LicenseResponse
    const max = licensePayload?.data?.attributes?.maxMachines ?? licensePayload?.maxMachines ?? 0

    res = await this.fetchWithRetry(
      `${this.host}/v1/accounts/${this.account}/machines?filter[license]=${input.licenseId}`,
      {
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'application/json',
          'Keygen-Version': this.version,
        },
      },
    )

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`[keygen] list machines failed: ${res.status} ${res.statusText} ${errText}`)
    }

    const machinesPayload = (await res.json().catch(() => ({}))) as MachinesResponse
    const used = Array.isArray(machinesPayload?.data) ? machinesPayload.data.length : 0

    if (max > 0 && used >= max) {
      throw new SeatsExhaustedError(max, used)
    }

    const body = {
      data: {
        type: 'machines',
        attributes: {
          fingerprint: input.fingerprint,
          ...(input.platform ? { platform: input.platform } : {}),
          ...(input.name ? { name: input.name } : {}),
          ...(input.meta ? { meta: input.meta } : {}),
        },
        relationships: {
          license: { data: { type: 'licenses', id: input.licenseId } },
        },
      },
    }

    res = await this.fetchWithRetry(`${this.host}/v1/accounts/${this.account}/machines`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Keygen-Version': this.version,
        'Idempotency-Key': `machine_${input.licenseId}_${input.fingerprint}`,
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      if (res.status === 409 || res.status === 422) {
        throw new SeatsExhaustedError(max, used)
      }
      throw new Error(`[keygen] create machine failed: ${res.status} ${res.statusText} ${errText}`)
    }

    const machinePayload = (await res.json().catch(() => ({}))) as KeygenResponse<MachinePayload>
    return {
      machineId: machinePayload?.data?.id,
      seats: { max, used: used + 1 },
      raw: machinePayload,
    }
  }

  /**
   * Removes a machine from Keygen for the provided machine ID.
   */
  async deleteMachine(machineId: string) {
    const res = await this.fetchWithRetry(`${this.host}/v1/accounts/${this.account}/machines/${machineId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        'Keygen-Version': this.version,
      },
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`[keygen] delete machine failed: ${res.status} ${res.statusText} ${errText}`)
    }

    return (await res.json().catch(() => ({}))) as Record<string, unknown>
  }

  /**
   * Generates and caches a temporary asset download link for a license.
   */
  async createDownloadLink(input: CreateDownloadLinkInput): Promise<DownloadLink> {
    const cacheKey = `${input.licenseId}:${input.assetId}:${input.filename ?? ''}`
    const cached = this.downloadCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return {
        url: cached.url,
        expiresAt: new Date(cached.expiresAt).toISOString(),
        ttlSeconds: cached.ttlSeconds,
        ...(cached.contentDisposition ? { contentDisposition: cached.contentDisposition } : {}),
      }
    }

    const body = {
      data: {
        type: 'download-links',
        relationships: {
          license: { data: { type: 'licenses', id: input.licenseId } },
        },
        ...(input.filename ? { attributes: { filename: input.filename } } : {}),
      },
    }

    let res: Response
    try {
      res = await this.fetchWithRetry(
        `${this.host}/v1/accounts/${this.account}/assets/${input.assetId}/actions/download`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'Keygen-Version': this.version,
          },
          body: JSON.stringify(body),
        },
      )
    } catch (e) {
      throw new Error(`[keygen] create download link request failed: ${e instanceof Error ? e.message : e}`)
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`[keygen] create download link failed: ${res.status} ${res.statusText} ${errText}`)
    }

    const payload = (await res.json().catch(() => ({}))) as {
      data?: {
        attributes?: {
          url?: string
          downloadUrl?: string
          expiresAt?: string
          expiry?: string
          ttlSeconds?: number
          contentDisposition?: string
        }
      }
    }
    const attrs = payload.data?.attributes ?? {}
    const url = attrs.url ?? attrs.downloadUrl ?? null
    const expiresAtStr = attrs.expiresAt ?? attrs.expiry ?? null
    const expiresAt = expiresAtStr ? Date.parse(expiresAtStr) : Date.now() + 900 * 1000
    const ttlSeconds = attrs.ttlSeconds ?? Math.floor((expiresAt - Date.now()) / 1000)
    const contentDisposition = attrs.contentDisposition

    if (!url) {
      throw new Error('[keygen] download link response missing url')
    }

    const link: DownloadLink = {
      url,
      expiresAt: new Date(expiresAt).toISOString(),
      ttlSeconds,
      ...(contentDisposition ? { contentDisposition } : {}),
    }

    this.downloadCache.set(cacheKey, {
      url,
      expiresAt,
      ttlSeconds,
      contentDisposition,
    })

    return link
  }
}
