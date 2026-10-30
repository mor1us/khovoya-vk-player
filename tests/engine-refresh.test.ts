import { describe, it, expect, vi } from 'vitest'
import { withUrlRefresh } from '../src/renderer/player/crossfade'

describe('withUrlRefresh', () => {
  it('first error → refresh → success', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce(undefined)
    const refresh = vi.fn(async () => 'https://new')
    expect(await withUrlRefresh('https://old', load, refresh)).toBe('ok')
    expect(load.mock.calls.map((c) => c[0])).toEqual(['https://old', 'https://new'])
  })
  it('two errors → skip', async () => {
    const load = vi.fn().mockRejectedValue(new Error('net'))
    expect(await withUrlRefresh('u', load, async () => 'v')).toBe('skip')
    expect(load).toHaveBeenCalledTimes(2)
  })
  it('refresh returns empty url → skip without second load', async () => {
    const load = vi.fn().mockRejectedValue(new Error('net'))
    expect(await withUrlRefresh('u', load, async () => '')).toBe('skip')
    expect(load).toHaveBeenCalledTimes(1)
  })
  it('empty initial url goes straight to refresh', async () => {
    const load = vi.fn().mockResolvedValue(undefined)
    expect(await withUrlRefresh('', load, async () => 'v')).toBe('ok')
    expect(load).toHaveBeenCalledWith('v')
  })
})
