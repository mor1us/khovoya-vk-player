import { describe, it, expect } from 'vitest'
import type { Track } from '../src/shared/types'
import { bestMatch, norm } from '../src/shared/match'

const t = (id: string, artist: string, title: string, duration = 180, available = true): Track =>
  ({ id, ownerId: 1, vkId: 1, title, artist, duration, url: '', available })

describe('поиск того же трека на другом сервисе', () => {
  it('нормализует названия', () => {
    expect(norm('Самый Лучший День (prod. X)')).toBe('самый лучший день')
    expect(norm('Ёлка feat. Кто-то')).toBe('елка')
  })
  it('находит совпадение и отбрасывает другие версии по длине', () => {
    const vk = t('v', 'Кишлак', 'Самый лучший день', 93)
    const cands = [t('a', 'Кишлак', 'Самый лучший день (slowed)', 140), t('b', 'кишлак', 'Самый лучший день', 95), t('c', 'Другой', 'Самый лучший день', 93)]
    expect(bestMatch(vk, cands)?.id).toBe('b')
  })
  it('ничего — если не нашлось или трек недоступен', () => {
    expect(bestMatch(t('v', 'A', 'Song'), [t('x', 'A', 'Song', 180, false)])).toBeNull()
    expect(bestMatch(t('v', 'A', 'Song'), [t('x', 'B', 'Other')])).toBeNull()
  })
})
