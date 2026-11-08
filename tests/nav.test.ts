import { describe, it, expect } from 'vitest'
import { pushSpot, stepBack, stepForward, sameSpot, type Spot } from '../src/renderer/store/navLogic'

const spot = (tab: string, over: Partial<Spot> = {}): Spot => ({ tab, playlist: null, artist: null, submitted: '', ...over })
const pl = (id: number) => ({ id, ownerId: 1, title: 'П' + id, count: 0, coverUrls: [], isMine: true, updatedAt: 0 })

describe('история переходов', () => {
  it('одна вкладка — разные места: плейлисты и артисты не путаются', () => {
    expect(sameSpot(spot('playlist', { playlist: pl(1) }), spot('playlist', { playlist: pl(2) }))).toBe(false)
    expect(sameSpot(spot('artist', { artist: { name: 'A', src: 'vk' } }), spot('artist', { artist: { name: 'A', src: 'sc' } }))).toBe(false)
    expect(sameSpot(spot('home'), spot('home'))).toBe(true)
  })

  it('повторный переход в то же место не копится в истории', () => {
    expect(pushSpot([], spot('home'), spot('home'))).toBeNull()
  })

  it('путь плейлист → трек → артист отматывается обратно', () => {
    const a = spot('playlist', { playlist: pl(7) })
    const b = spot('search', { submitted: 'асфальт' })
    const c = spot('artist', { artist: { name: 'Jakone' } })
    let history: Spot[] = [a, b]
    let ahead: Spot[] = []
    const first = stepBack(history, ahead, c)!
    expect(first.spot).toEqual(b)
    history = first.history; ahead = first.ahead
    const second = stepBack(history, ahead, first.spot)!
    expect(second.spot).toEqual(a) // вернулись к плейлисту, тому самому
  })

  it('вперёд возвращает то, откуда ушёл назад', () => {
    const back = stepBack([spot('home')], [], spot('mine'))!
    const fwd = stepForward(back.history, back.ahead, back.spot)!
    expect(fwd.spot).toEqual(spot('mine'))
    expect(fwd.ahead).toEqual([])
  })

  it('идти некуда — ничего не делаем', () => {
    expect(stepBack([], [], spot('home'))).toBeNull()
    expect(stepForward([], [], spot('home'))).toBeNull()
  })

  it('новый переход стирает «вперёд»', () => {
    expect(pushSpot([spot('home')], spot('mine'), spot('search'))!.ahead).toEqual([])
  })
})
