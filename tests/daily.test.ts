import { describe, it, expect } from 'vitest'
import type { Playlist } from '../src/shared/types'
import { dailyOnly } from '../src/renderer/store/dailyLogic'

const pl = (id: number, title: string): Playlist => ({ id, ownerId: -1, title, count: 30, coverUrls: [], isMine: false, updatedAt: 0 })

describe('плейлисты дня', () => {
  it('оставляет только «Плейлист дня», без подборок редакции и повторов', () => {
    const r = dailyOnly([
      { playlists: [pl(1, 'Для вас'), pl(2, 'Плейлист дня 1'), pl(3, 'Плейлист дня 2')] },
      { playlists: [pl(4, 'Один Дома: вспоминай'), pl(2, 'Плейлист дня 1')] }
    ])
    expect(r.map((p) => p.id)).toEqual([2, 3])
  })
})
