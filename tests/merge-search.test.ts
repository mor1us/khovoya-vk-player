import { describe, it, expect } from 'vitest'
import type { Track } from '../src/shared/types'
import { mergeSources } from '../src/renderer/ui/mergeSearch'

const t = (id: string, artist: string, title: string, sc = false): Track =>
  ({ id, ownerId: 1, vkId: 1, title, artist, duration: 1, url: '', available: true, ...(sc ? { src: 'sc' as const } : {}) })

describe('общая выдача ВК + SoundCloud', () => {
  it('чередует источники и убирает повторы в пользу ВК', () => {
    const r = mergeSources([t('v1', 'A', 'One'), t('v2', 'B', 'Two'), t('v3', 'C', 'Three')], [t('s1', 'a', 'one', true), t('s2', 'D', 'Four', true)])
    expect(r.map((x) => x.id)).toEqual(['v1', 's2', 'v2', 'v3'])
  })
  it('если одного источника нет — просто второй', () => {
    expect(mergeSources([], [t('s1', 'A', 'One', true)]).map((x) => x.id)).toEqual(['s1'])
  })
})
