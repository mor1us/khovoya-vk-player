/** Ошибки наружу уходят текстом без кодов — одинаково на компьютере и на телефоне. */
export function friendly(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e)
  if (/fetch failed|ENOTFOUND|ECONN|network/i.test(msg)) return new Error('Нет подключения')
  return new Error(msg || 'Что-то пошло не так')
}
