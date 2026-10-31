import { describe, it, expect } from 'vitest'
import type { Track } from '../src/shared/types'
import { buildSuggest } from '../src/renderer/ui/searchSuggest'

const t = (id: string, artist: string, title: string): Track => ({ id, ownerId: 1, vkId: 1, title, artist, duration: 100, url: 'u', available: true })

describe('подсказки поиска', () => {
  it('сначала «искать», потом артисты, треки и варианты запроса', () => {
    const r = buildSuggest('форту', [t('1', 'FORTUNA 812', 'A'), t('2', 'ПАПА, фортуна 812', 'B'), t('3', 'FORTUNA 812', 'C'), t('4', 'Фортуна', 'D')], ['фортуна 812', 'фортуна', 'форту'], ['фортуна 2'])
    expect(r[0]).toEqual({ kind: 'search', q: 'форту' })
    expect(r.filter((x) => x.kind === 'artist').map((x) => (x as { name: string }).name)).toEqual(['ПАПА, фортуна 812', 'Фортуна'])
    expect(r.filter((x) => x.kind === 'track')).toHaveLength(3)
    expect(r.filter((x) => x.kind === 'query').map((x) => (x as { q: string }).q)).toEqual(['фортуна 2', 'фортуна 812', 'фортуна'])
  })
  it('пустой запрос — пусто', () => { expect(buildSuggest('  ', [], [], [])).toEqual([]) })
})

describe('артисты из обоих мест', () => {
  it('артисты ВК и SoundCloud помечены, повтор по имени — один раз', () => {
    const r = buildSuggest('neon', [t('1', 'Neon', 'A')], [], [], [{ name: 'neon', followers: 5 }, { name: 'Neon Kid', followers: 900 }])
    expect(r.filter((x) => x.kind === 'artist').map((x) => [(x as { name: string }).name, (x as { src: string }).src])).toEqual([['Neon', 'vk'], ['Neon Kid', 'sc']])
  })
})
