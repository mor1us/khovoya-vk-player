import { describe, it, expect } from 'vitest'
import { pickLayout } from '../src/renderer/ui/layout'

describe('pickLayout', () => {
  it('на Android — телефонная раскладка', () => {
    expect(pickLayout('android')).toBe('phone')
  })
  it('на компьютере — обычная', () => {
    expect(pickLayout('web')).toBe('desktop')
    expect(pickLayout('electron')).toBe('desktop')
    expect(pickLayout('ios')).toBe('desktop')
  })
  it('узкое окно на компьютере остаётся компьютерным', () => {
    // раскладка выбирается по платформе, а не по ширине: иначе Хвоя в узком окне
    // начнёт притворяться телефоном
    expect(pickLayout('electron')).toBe('desktop')
    expect(pickLayout('web')).toBe('desktop')
  })
})
