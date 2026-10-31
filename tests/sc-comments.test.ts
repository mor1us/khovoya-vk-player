import { describe, it, expect } from 'vitest'
import { commentAt } from '../src/renderer/ui/commentAt'

describe('комментарии по ходу трека', () => {
  const list = [{ at: 3, text: 'a', user: 'u' }, { at: 9, text: 'b', user: 'v' }, { at: 10, text: 'c', user: 'w' }]
  it('показываем комментарий своей секунды, 4 секунды', () => {
    expect(commentAt(list, 2)).toBeNull()
    expect(commentAt(list, 3.5)?.text).toBe('a')
    expect(commentAt(list, 7.5)).toBeNull()
    expect(commentAt(list, 10.2)?.text).toBe('c')
  })
})
