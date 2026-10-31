import { describe, it, expect } from 'vitest'
import { buildActivity } from '../src/main/system/discordActivity'
import type { Track } from '../src/shared/types'

const t: Track = { id: '1_2', ownerId: 1, vkId: 2, title: 'Холодный свет', artist: 'Северный ветер', duration: 221, url: 'u', available: true, coverUrl: 'https://img/c.jpg' }
const NOW = 1_700_000_000_000

describe('buildActivity', () => {
  it('paused or no track → null', () => {
    expect(buildActivity(t, false, 10, NOW)).toBeNull()
    expect(buildActivity(null, true, 0, NOW)).toBeNull()
  })
  it('listening activity with timestamps and cover', () => {
    expect(buildActivity(t, true, 84, NOW)).toEqual({
      type: 2, details: 'Холодный свет', state: 'Северный ветер',
      largeImageKey: 'https://img/c.jpg', largeImageText: 'ВКонтакте',
      startTimestamp: NOW - 84_000, endTimestamp: NOW - 84_000 + 221_000
    })
  })
  it('no https cover → logo', () => {
    expect(buildActivity({ ...t, coverUrl: undefined }, true, 0, NOW)!.largeImageKey).toBe('logo')
    expect(buildActivity({ ...t, coverUrl: 'data:image/svg+xml,x' }, true, 0, NOW)!.largeImageKey).toBe('logo')
  })
  it('trims details/state to 128 and pads short ones to 2 chars', () => {
    const a = buildActivity({ ...t, title: 'x'.repeat(300), artist: 'Я' }, true, 0, NOW)!
    expect(a.details!.length).toBe(128); expect(a.state!.length).toBeGreaterThanOrEqual(2)
  })
  it('no duration → no end timestamp', () => {
    expect(buildActivity({ ...t, duration: 0 }, true, 5, NOW)!.endTimestamp).toBeUndefined()
  })
})

describe('статус Discord: откуда трек', () => {
  it('у треков SoundCloud подписано «SoundCloud»', () => {
    const t = { id: 'sc_1', ownerId: 0, vkId: 1, title: 'Song', artist: 'Art', duration: 100, url: '', available: true, src: 'sc' as const }
    expect(buildActivity(t, true, 0, 1000)?.largeImageText).toBe('SoundCloud')
  })
})
