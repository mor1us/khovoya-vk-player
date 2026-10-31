import { describe, it, expect } from 'vitest'
import { sourceParts } from '../src/renderer/ui/source'

describe('откуда играет', () => {
  it('разбирает источник на вид и название', () => {
    expect(sourceParts('pl:Фонк')).toEqual({ kind: 'плейлиста', name: 'Фонк' })
    expect(sourceParts('wave:mix')).toEqual({ kind: 'Волны', name: 'Волна' })
    expect(sourceParts('mine')).toEqual({ kind: 'раздела', name: 'Моя музыка' })
    expect(sourceParts('search:кишлак')).toEqual({ kind: 'поиска', name: 'кишлак' })
    expect(sourceParts('mix:Забытое любимое')).toEqual({ kind: 'микса', name: 'Забытое любимое' })
  })
})
