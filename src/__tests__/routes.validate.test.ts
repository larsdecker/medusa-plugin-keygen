import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRes = () => {
  const r: any = {}
  r.status = vi.fn().mockReturnValue(r)
  r.json = vi.fn().mockReturnValue(r)
  return r
}

describe('Validate route', () => {
  beforeEach(() => {
    process.env.KEYGEN_ACCOUNT = 'acct_123'
    process.env.KEYGEN_TOKEN = 'tok_123'
    delete process.env.KEYGEN_HOST
    vi.resetModules()
  })

  it('validates a product id', async () => {
    // @ts-expect-error mock fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { id: 'prod_1', attributes: { name: 'My Product' } } }),
    })

    const { POST: validate } = await import('../api/admin/keygen/validate/route')
    const req: any = { body: { type: 'product', id: 'prod_1' } }
    const res: any = mockRes()

    await validate(req, res)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.keygen.sh/v1/accounts/acct_123/products/prod_1',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Keygen-Version': '1.8' }),
      }),
    )
    expect(res.json).toHaveBeenCalledWith({ id: 'prod_1', type: 'product', name: 'My Product' })
  })

  it('uses custom host from env', async () => {
    process.env.KEYGEN_HOST = 'https://custom.example.com'
    vi.resetModules()
    // @ts-expect-error mock fetch
    global.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ data: { id: 'prod_1', attributes: { name: 'A' } } }) })
    const { POST: validate } = await import('../api/admin/keygen/validate/route')
    const req: any = { body: { type: 'product', id: 'prod_1' } }
    const res: any = mockRes()
    await validate(req, res)
    expect(global.fetch).toHaveBeenCalledWith(
      'https://custom.example.com/v1/accounts/acct_123/products/prod_1',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Keygen-Version': '1.8' }),
      }),
    )
  })
})
