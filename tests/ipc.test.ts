import { describe, it, expect } from 'vitest'
import { isAllowedChannel, IPC } from '../src/shared/ipc'
describe('ipc whitelist', () => {
  it('allows known channels', () => {
    expect(isAllowedChannel('vk:search')).toBe(true)
    expect(isAllowedChannel('wave:get')).toBe(true)
  })
  it('rejects unknown channels', () => {
    expect(isAllowedChannel('fs:read')).toBe(false)
    expect(isAllowedChannel('__proto__')).toBe(false)
    expect(isAllowedChannel(42 as unknown as string)).toBe(false)
  })
  it('has every channel the plan lists', () => {
    for (const c of ['auth:login','auth:logout','auth:session','vk:myTracks','vk:playlists','pl:reorder','dl:start','settings:set','win:close','discord:update']) expect(IPC).toHaveProperty(c)
  })
})
