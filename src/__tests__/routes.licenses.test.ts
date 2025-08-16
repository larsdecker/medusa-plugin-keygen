import { describe, it, expect, vi } from 'vitest'
import { GET, POST } from '../api/admin/keygen/licenses/[order_id]/route'

const mockRes = () => {
  const r: any = {}
  r.status = vi.fn().mockReturnValue(r)
  r.json = vi.fn().mockReturnValue(r)
  return r
}

describe('Licenses routes', () => {
  it('returns stored licenses', async () => {
    const data = [
      {
        id: 'lic_db_1',
        order_id: 'order_1',
        license_key: 'AAAA-BBBB-CCCC',
        keygen_license_id: 'lic_1',
      },
    ]
    const query = { graph: vi.fn().mockResolvedValue({ data }) }
    const req: any = {
      params: { order_id: 'order_1' },
      scope: { resolve: (key: string) => (key === 'query' ? query : undefined) },
    }
    const res: any = mockRes()

    await GET(req, res)

    expect(query.graph).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'keygen_license',
        filters: { order_id: 'order_1' },
      }),
    )
    expect(res.json).toHaveBeenCalledWith({ licenses: data })
  })

  it('creates a license via service', async () => {
    const record = { id: 'lic_db_2', license_key: 'DDDD-EEEE-FFFF' }
    const keygenService = {
      createLicense: vi.fn().mockResolvedValue({ record }),
    }
    const req: any = {
      params: { order_id: 'order_1' },
      body: { policyId: 'pol_1', productId: 'prod_1', orderItemId: 'item_1' },
      scope: { resolve: (key: string) => (key === 'keygenService' ? keygenService : undefined) },
    }
    const res: any = mockRes()

    await POST(req, res)

    expect(keygenService.createLicense).toHaveBeenCalledWith({
      orderId: 'order_1',
      orderItemId: 'item_1',
      policyId: 'pol_1',
      productId: 'prod_1',
    })
    expect(res.status).toHaveBeenCalledWith(201)
    expect(res.json).toHaveBeenCalledWith({ license: record })
  })

  it('requires policyId or productId', async () => {
    const keygenService = {
      createLicense: vi.fn(),
    }
    const req: any = {
      params: { order_id: 'order_1' },
      body: {},
      scope: { resolve: (key: string) => (key === 'keygenService' ? keygenService : undefined) },
    }
    const res: any = mockRes()

    await POST(req, res)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({ message: 'policyId or productId required' })
    expect(keygenService.createLicense).not.toHaveBeenCalled()
  })
})
