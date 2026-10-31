export function sourceLabel(src: string): string {
  if (!src) return ''
  if (src.startsWith('wave:')) return 'Волна / ' + (({ mix: 'Микс', new: 'Новое', fav: 'Любимое', sc: 'SoundCloud', both: 'ВК + SoundCloud' } as Record<string, string>)[src.slice(5)] ?? 'Микс')
  if (src === 'mine') return 'Моя музыка'
  if (src.startsWith('pl:')) return 'Плейлист / ' + src.slice(3)
  if (src.startsWith('search:')) return 'Поиск / ' + src.slice(7)
  if (src === 'similar') return 'Похоже на это'
  if (src === 'downloads') return 'Загрузки'
  if (src === 'history') return 'История'
  if (src.startsWith('mix:')) return 'Микс / ' + src.slice(4)
  if (src.startsWith('artist:')) return 'Артист / ' + src.slice(7)
  return src
}

/** Для экрана очереди: «Сейчас играет из плейлиста» + крупное название. */
export function sourceParts(src: string): { kind: string; name: string } {
  const after = (p: string) => src.slice(p.length)
  if (src === 'wave:sc') return { kind: 'Волны', name: 'Волна SoundCloud' }
  if (src === 'wave:both') return { kind: 'Волны', name: 'Волна ВК + SoundCloud' }
  if (src.startsWith('wave:')) return { kind: 'Волны', name: 'Волна' }
  if (src === 'mine') return { kind: 'раздела', name: 'Моя музыка' }
  if (src.startsWith('pl:')) return { kind: 'плейлиста', name: after('pl:') }
  if (src.startsWith('search:')) return { kind: 'поиска', name: after('search:') }
  if (src === 'similar') return { kind: 'подборки', name: 'Похожее' }
  if (src === 'downloads') return { kind: 'раздела', name: 'Загрузки' }
  if (src === 'history') return { kind: 'раздела', name: 'История' }
  if (src.startsWith('mix:')) return { kind: 'микса', name: after('mix:') }
  if (src.startsWith('artist:')) return { kind: 'артиста', name: after('artist:') }
  return { kind: '', name: src }
}
