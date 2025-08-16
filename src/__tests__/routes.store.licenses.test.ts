import { describe, it, expect, vi } from 'vitest'
import type { MedusaRequest, MedusaResponse } from '@medusajs/framework/http'
import { GET as LIST } from '../api/store/me/licenses/route'
import { GET as DETAIL } from '../api/store/me/licenses/[license_id]/route'
import { POST as DOWNLOAD } from '../api/store/me/licenses/[license_id]/download/route'

const mockRes = (): MedusaResponse => {
  const r = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  }
  return r as unknown as MedusaResponse
}

describe('Store license routes', () => {
  it('lists customer licenses', async () => {
    const data = [
      {
        keygen_license_id: 'lic_1',
        license_key: 'AAAA-BBBB',
        status: 'created',
        keygen_product_id: 'prod_1',
      },
    ]
    const query = { graph: vi.fn().mockResolvedValue({ data }) }
    const req = {
      scope: { resolve: (k: string) => (k === 'query' ? query : undefined) },
      user: { id: 'cust_1' },
    } as unknown as MedusaRequest
    const res = mockRes()

    await LIST(req, res)

    expect(query.graph).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: { customer_id: 'cust_1' },
        orderBy: { created_at: 'desc' },
      }),
    )
    expect(res.json).toHaveBeenCalledWith({
      licenses: [
        {
          id: 'lic_1',
          key: '****-BBBB',
          status: 'created',
          product: { id: 'prod_1' },
        },
      ],
    })
  })

  it('supports pagination and filters', async () => {
    const data = [
      {
        keygen_license_id: 'lic_1',
        license_key: 'AAAA-BBBB',
        status: 'created',
        keygen_product_id: 'prod_1',
      },
    ]
    const query = {
      graph: vi.fn().mockResolvedValue({ data, metadata: { count: 30 } }),
    }
    const req = {
      scope: { resolve: (k: string) => (k === 'query' ? query : undefined) },
      user: { id: 'cust_1' },
      query: {
        limit: '20',
        offset: '10',
        q: 'prod',
        order: 'created_at:desc',
        productId: 'prod_1',
        status: 'created',
      },
    } as unknown as MedusaRequest
    const res = mockRes()

    await LIST(req, res)

    expect(query.graph).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: {
          customer_id: 'cust_1',
          q: 'prod',
          keygen_product_id: 'prod_1',
          status: 'created',
        },
        pagination: { take: 20, skip: 10 },
        orderBy: { created_at: 'desc' },
      }),
    )
    expect(res.json).toHaveBeenCalledWith({
      licenses: [
        {
          id: 'lic_1',
          key: '****-BBBB',
          status: 'created',
          product: { id: 'prod_1' },
        },
      ],
      count: 30,
      limit: 20,
      offset: 10,
    })
  })

  it('returns license details', async () => {
    const data = [
      {
        keygen_license_id: 'lic_1',
        license_key: 'AAAA-BBBB',
        status: 'created',
        keygen_product_id: 'prod_1',
      },
    ]
    const query = { graph: vi.fn().mockResolvedValue({ data }) }
    const keygenService = {
      getLicenseWithMachines: vi.fn().mockResolvedValue({
        id: 'lic_1',
        key: 'AAAA-BBBB',
        status: 'active',
        maxMachines: 2,
        machines: [{ id: 'mach_1' }],
      }),
    }
    const req = {
      params: { license_id: 'lic_1' },
      scope: {
        resolve: (k: string) => (k === 'query' ? query : k === 'keygenService' ? keygenService : undefined),
      },
      user: { id: 'cust_1' },
    } as unknown as MedusaRequest
    const res = mockRes()

    await DETAIL(req, res)

    expect(keygenService.getLicenseWithMachines).toHaveBeenCalledWith('lic_1')
    expect(res.json).toHaveBeenCalledWith({
      license: {
        id: 'lic_1',
        key: 'AAAA-BBBB',
        status: 'active',
        product: { id: 'prod_1' },
        max_machines: 2,
        machines: [{ id: 'mach_1' }],
      },
    })
  })

  it('creates download link', async () => {
    const query = {
      graph: vi.fn().mockResolvedValue({
        data: [{ keygen_license_id: 'lic_1' }],
      }),
    }
    const link = {
      url: 'https://s3.example.com/file',
      expiresAt: '2030-01-01T00:00:00Z',
      ttlSeconds: 900,
    }
    const keygenService = {
      createDownloadLink: vi.fn().mockResolvedValue(link),
    }
    const req = {
      params: { license_id: 'lic_1' },
      body: { assetId: 'asset_1' },
      scope: {
        resolve: (k: string) => (k === 'query' ? query : k === 'keygenService' ? keygenService : undefined),
      },
      user: { id: 'cust_1' },
    } as unknown as MedusaRequest
    const res = mockRes()

    await DOWNLOAD(req, res)

    expect(keygenService.createDownloadLink).toHaveBeenCalledWith({
      licenseId: 'lic_1',
      assetId: 'asset_1',
      filename: undefined,
    })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({
      link,
      licenseId: 'lic_1',
      assetId: 'asset_1',
    })
  })
})
