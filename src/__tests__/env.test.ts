import { describe, it, expect, vi } from 'vitest'

describe('env config', () => {
  it('throws if required vars are missing', async () => {
    const origAcc = process.env.KEYGEN_ACCOUNT
    const origTok = process.env.KEYGEN_TOKEN
    vi.resetModules()
    delete process.env.KEYGEN_ACCOUNT
    delete process.env.KEYGEN_TOKEN
    await expect(import('../config/env')).rejects.toThrow()
    process.env.KEYGEN_ACCOUNT = origAcc
    process.env.KEYGEN_TOKEN = origTok
  })
})
