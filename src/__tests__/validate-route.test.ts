import { describe, it, expect, vi, beforeEach } from 'vitest'
let POST: any

describe('validate route', () => {
  beforeEach(async () => {
    process.env.KEYGEN_ACCOUNT = 'acc'
    process.env.KEYGEN_TOKEN = 'tok'
    process.env.KEYGEN_VERSION = '1.8'
    vi.resetModules()
    POST = (await import('../api/admin/keygen/validate/route')).POST
  })

  it('returns generic message on upstream error', async () => {
    const req: any = { body: { type: 'product', id: '123' } }
    const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() }

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      text: vi.fn().mockResolvedValue('sensitive error'),
    }) as any

    await POST(req, res)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ message: 'Validation failed' })
    expect(global.fetch).toHaveBeenCalled()
  })
})
