export function sourceLabel(src: string): string {
  if (!src) return ''
  if (src.startsWith('wave:')) return 'Волна / ' + ({ mix: 'Микс', new: 'Новое', fav: 'Любимое' } as Record<string, string>)[src.slice(5)]
  if (src === 'mine') return 'Моя музыка'
  if (src.startsWith('pl:')) return 'Плейлист / ' + src.slice(3)
  if (src.startsWith('search:')) return 'Поиск / ' + src.slice(7)
  if (src === 'similar') return 'Похоже на это'
  if (src === 'downloads') return 'Загрузки'
  if (src === 'history') return 'История'
  if (src.startsWith('artist:')) return 'Артист / ' + src.slice(7)
  return src
}
