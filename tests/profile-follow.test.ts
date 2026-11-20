import { describe, expect, it, vi } from 'vitest'
import { profileFollowControl, soundCloudProfile } from '../src/main/auth/profileFollowLogic'

function button(text: string, { modal = false, disabled = false } = {}) {
  return {
    textContent: text,
    getClientRects: () => [1],
    closest: (selector: string) => modal && selector.includes('role="dialog"') ? {} : null,
    hasAttribute: (name: string) => disabled && name === 'disabled',
    getAttribute: () => null,
    classList: { contains: () => false },
    click: vi.fn()
  }
}
const page = (...buttons: ReturnType<typeof button>[]) => ({ querySelectorAll: () => buttons }) as unknown as Document

describe('кнопка подписки официальной страницы', () => {
  it('нажимает «Подписаться» ВК и оставляет уже существующую подписку', () => {
    const off = button('Подписаться')
    expect(profileFollowControl('vk', 'follow', page(off))).toBe(false)
    expect(off.click).toHaveBeenCalledOnce()
    const on = button('Вы подписаны')
    expect(profileFollowControl('vk', 'follow', page(on))).toBe(true)
    expect(on.click).not.toHaveBeenCalled()
  })

  it('нажимает Following SoundCloud и подтверждает отписку только внутри диалога', () => {
    const on = button('Following')
    expect(profileFollowControl('sc', 'unfollow', page(on))).toBe(true)
    expect(on.click).toHaveBeenCalledOnce()
    const confirm = button('Отписаться', { modal: true })
    const other = button('Отписаться')
    expect(profileFollowControl('vk', 'confirm', page(confirm, other))).toBe(true)
    expect(confirm.click).toHaveBeenCalledOnce()
    expect(other.click).not.toHaveBeenCalled()
  })

  it('пропускает неактивные и неоднозначные кнопки и принимает только профиль SoundCloud', () => {
    const a = button('Follow')
    const b = button('Follow')
    expect(profileFollowControl('sc', 'follow', page(a, b))).toBeNull()
    expect(profileFollowControl('sc', 'follow', page(button('Follow', { disabled: true })))).toBeNull()
    expect(a.click).not.toHaveBeenCalled()
    expect(b.click).not.toHaveBeenCalled()
    expect(soundCloudProfile('https://www.soundcloud.com/emberanonymous?src=test')?.href).toBe('https://soundcloud.com/emberanonymous')
    expect(soundCloudProfile('https://soundcloud.com/emberanonymous/track')).toBeUndefined()
    expect(soundCloudProfile('https://soundcloud.com.example/emberanonymous')).toBeUndefined()
  })
})
