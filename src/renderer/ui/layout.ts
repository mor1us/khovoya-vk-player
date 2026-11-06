/**
 * Раскладка выбирается один раз при старте и только по платформе.
 * Не по ширине окна: иначе компьютерная Хвоя в узком окне начнёт притворяться телефоном.
 */
export type Layout = 'desktop' | 'phone'

export function pickLayout(platform: string): Layout {
  return platform === 'android' ? 'phone' : 'desktop'
}

/** Capacitor кладёт себя в window; на компьютере его нет. */
export function currentPlatform(): string {
  if (typeof window === 'undefined') return 'node'
  const cap = (window as unknown as { Capacitor?: { getPlatform?: () => string } }).Capacitor
  return cap?.getPlatform?.() ?? 'electron'
}

let cached: Layout | null = null
/** Считается один раз за запуск и дальше не меняется. */
export function layout(): Layout {
  if (cached === null) cached = pickLayout(currentPlatform())
  return cached
}

export const isPhone = () => layout() === 'phone'
