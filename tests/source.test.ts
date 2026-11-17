import { describe, it, expect } from 'vitest'
import { artistFromSource, artistSource, sourceLabel, sourceParts } from '../src/renderer/ui/source'

describe('откуда играет', () => {
  it('разбирает источник на вид и название', () => {
    expect(sourceParts('pl:Фонк')).toEqual({ kind: 'плейлиста', name: 'Фонк' })
    expect(sourceParts('wave:mix')).toEqual({ kind: 'Волны', name: 'Волна' })
    expect(sourceParts('mine')).toEqual({ kind: 'раздела', name: 'Моя музыка' })
    expect(sourceParts('search:кишлак')).toEqual({ kind: 'поиска', name: 'кишлак' })
    expect(sourceParts('mix:Забытое любимое')).toEqual({ kind: 'микса', name: 'Забытое любимое' })
  })

  it('сохраняет платформу и id артиста при переходе из очереди', () => {
    const source = artistSource({ src: 'sc', id: '123:45', name: 'Mori:us / Band' })
    expect(artistFromSource(source)).toEqual({ src: 'sc', id: '123:45', name: 'Mori:us / Band' })
    expect(sourceLabel(source)).toBe('Артист / Mori:us / Band')
    expect(sourceParts(source)).toEqual({ kind: 'артиста', name: 'Mori:us / Band' })
  })

  it('понимает старый источник артиста', () => {
    expect(artistFromSource('artist:Дворы')).toEqual({ src: 'vk', name: 'Дворы' })
  })
})
