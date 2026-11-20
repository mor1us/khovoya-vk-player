export type FollowService = 'vk' | 'sc'

// Выполняется внутри сайта. Выбираем одну видимую кнопку с известным состоянием.
export function profileFollowControl(service: FollowService, action: 'read' | 'follow' | 'unfollow' | 'confirm', root = document): boolean | null {
  const controls = 'button, [role="button"], [role="menuitem"]'
  const dialog = '[role="dialog"], [aria-modal="true"], [role="menu"]'
  const visible = (button: HTMLElement) => button.getClientRects().length > 0
    && !button.closest('[hidden], [aria-hidden="true"]')
    && !button.hasAttribute('disabled') && button.getAttribute('aria-disabled') !== 'true'
  const label = (button: HTMLElement) => (button.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()

  if (action === 'confirm') {
    const buttons = Array.from(root.querySelectorAll<HTMLElement>(controls)).filter((button) =>
      visible(button) && button.closest(dialog) && /^(отписаться|unfollow)$/.test(label(button)))
    if (buttons.length !== 1) return null
    buttons[0].click()
    return true
  }

  const selector = service === 'sc' ? '.userInfoBar button.sc-button-follow, .profileHeader button.sc-button-follow' : controls
  const matches: { button: HTMLElement; followed: boolean }[] = []
  for (const button of root.querySelectorAll<HTMLElement>(selector)) {
    if (!visible(button) || button.closest(dialog)) continue
    const titles = [label(button), button.getAttribute('aria-label')?.trim().toLowerCase()]
    const subscribed = service === 'vk' ? /^(вы подписаны|отписаться)$/ : /^(following|unfollow)$/
    const unsubscribed = service === 'vk' ? /^подписаться$/ : /^follow$/
    if (titles.some((text) => text && subscribed.test(text)) || (service === 'sc' && button.classList.contains('sc-button-selected'))) {
      matches.push({ button, followed: true })
    } else if (titles.some((text) => text && unsubscribed.test(text))) {
      matches.push({ button, followed: false })
    }
  }
  if (matches.length !== 1) return null
  const { button, followed } = matches[0]
  if ((action === 'follow' && !followed) || (action === 'unfollow' && followed)) button.click()
  return followed
}

export function soundCloudProfile(value: string): URL | undefined {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' || !['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com'].includes(url.hostname) || url.port || url.username || url.password) return
    if (!/^\/[a-z0-9_-]+\/?$/i.test(url.pathname)) return
    return new URL(url.pathname.replace(/\/$/, ''), 'https://soundcloud.com')
  } catch { /* Не адрес профиля. */ }
}
