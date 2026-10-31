export type UpdateState = {
  status: 'idle' | 'checking' | 'none' | 'available' | 'downloading' | 'ready' | 'error' | 'disabled'
  version?: string
  current?: string
  progress?: number
}

export function updateText(s: UpdateState): string {
  switch (s.status) {
    case 'checking': return 'Проверяю обновления…'
    case 'none': return `У тебя последняя версия ${s.current ?? ''}`.trim()
    case 'available': return `Доступна версия ${s.version}`
    case 'downloading': return `Скачиваю обновление… ${Math.round((s.progress ?? 0) * 100)}%`
    case 'ready': return `Версия ${s.version} скачана — перезапусти, чтобы обновиться`
    case 'error': return 'Не удалось проверить обновления. Попробуй позже.'
    case 'disabled': return 'Автообновление ещё не настроено'
    default: return ''
  }
}

/** Откуда брать обновления: релизы GitHub. Без владельца и репозитория — выключено. */
export function feedFromConfig(c: { owner?: string; repo?: string } | undefined): { provider: 'github'; owner: string; repo: string } | null {
  return c?.owner && c?.repo ? { provider: 'github', owner: c.owner, repo: c.repo } : null
}
