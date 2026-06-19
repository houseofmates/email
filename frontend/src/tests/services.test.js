import { describe, it, expect, vi } from 'vitest'
import { simpleloginService } from '../services/simplelogin'
import { vaultwardenService } from '../services/vaultwarden'
global.fetch = vi.fn()
describe('Services Integration', () => {
  it('simpleloginService calls v2 endpoint', async () => {
    fetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ aliases: [] }) })
    await simpleloginService.listAliases('auth')
    expect(fetch).toHaveBeenCalledWith('/api/aliases/v2/aliases', expect.any(Object))
  })
})
