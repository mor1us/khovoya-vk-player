import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSc } from '../src/renderer/store/sc'
import type { Track } from '../src/shared/types'

const track: Track = { id: 'sc_1', ownerId: 0, vkId: 1, title: 'Song', artist: 'Band', duration: 100, url: '', available: true, src: 'sc' }

describe('SoundCloud likes store', () => {
  const invoke = vi.fn()

  beforeEach(() => {
    invoke.mockReset().mockResolvedValue(undefined)
    vi.stubGlobal('window', { api: { invoke } })
    useSc.setState({ likes: [], accLikes: [track], me: { id: 7, name: 'User' }, loaded: true, accError: '' })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('restores account like state when unlike fails on SoundCloud', async () => {
    invoke.mockImplementation(async (channel: string) => {
      if (channel === 'scacc:like') throw new Error('нет связи')
      return undefined
    })
    await expect(useSc.getState().toggle(track)).rejects.toThrow('В Хвое лайк снят, а на SoundCloud — нет')
    expect(useSc.getState().accLikes).toEqual([track])
    expect(useSc.getState().isLiked(track.id)).toBe(true)
  })
})
