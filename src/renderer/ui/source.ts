import type { ArtistRef } from '../../shared/types'

/** Источник очереди артиста хранит платформу и id, чтобы переход из очереди вернул тот же профиль. */
export function artistSource(a: ArtistRef & { src?: 'vk' | 'sc' }): string {
  return `artist2:${a.src ?? 'vk'}:${encodeURIComponent(a.id ?? '')}:${encodeURIComponent(a.name)}`
}

export function artistFromSource(src: string): (ArtistRef & { src: 'vk' | 'sc' }) | null {
  if (src.startsWith('artist2:')) {
    const [, platform, id, ...nameParts] = src.split(':')
    const name = nameParts.join(':')
    if ((platform !== 'vk' && platform !== 'sc') || !name) return null
    try {
      return { src: platform, id: decodeURIComponent(id) || undefined, name: decodeURIComponent(name) }
    } catch { return null }
  }
  if (src.startsWith('artist:')) return { src: 'vk', name: src.slice(7) }
  return null
}

export function sourceLabel(src: string): string {
  if (!src) return ''
  if (src.startsWith('wave:')) return 'Волна / ' + (({ mix: 'Микс', new: 'Новое', fav: 'Любимое', sc: 'SoundCloud', both: 'ВК + SoundCloud' } as Record<string, string>)[src.slice(5)] ?? 'Микс')
  if (src === 'mine') return 'Моя музыка'
  if (src === 'sc:likes') return 'Лайки SoundCloud'
  if (src === 'sc:feed') return 'Лента SoundCloud'
  if (src.startsWith('pl:')) return src.slice(3)
  if (src.startsWith('search:')) return 'Поиск / ' + src.slice(7)
  if (src === 'similar') return 'Похоже на это'
  if (src === 'downloads') return 'Загрузки'
  if (src === 'history') return 'История'
  if (src.startsWith('mix:')) return 'Микс / ' + src.slice(4)
  const artist = artistFromSource(src)
  if (artist) return 'Артист / ' + artist.name
  return src
}

/** Для экрана очереди: «Сейчас играет из плейлиста» + крупное название. */
export function sourceParts(src: string): { kind: string; name: string } {
  const after = (p: string) => src.slice(p.length)
  if (src === 'wave:sc') return { kind: 'Волны', name: 'Волна SoundCloud' }
  if (src === 'wave:both') return { kind: 'Волны', name: 'Волна ВК + SoundCloud' }
  if (src.startsWith('wave:')) return { kind: 'Волны', name: 'Волна' }
  if (src === 'mine') return { kind: 'раздела', name: 'Моя музыка' }
  if (src === 'sc:likes') return { kind: 'раздела', name: 'Лайки SoundCloud' }
  if (src === 'sc:feed') return { kind: 'раздела', name: 'Лента SoundCloud' }
  if (src.startsWith('pl:')) return { kind: 'плейлиста', name: after('pl:') }
  if (src.startsWith('search:')) return { kind: 'поиска', name: after('search:') }
  if (src === 'similar') return { kind: 'подборки', name: 'Похожее' }
  if (src === 'downloads') return { kind: 'раздела', name: 'Загрузки' }
  if (src === 'history') return { kind: 'раздела', name: 'История' }
  if (src.startsWith('mix:')) return { kind: 'микса', name: after('mix:') }
  const artist = artistFromSource(src)
  if (artist) return { kind: 'артиста', name: artist.name }
  return { kind: '', name: src }
}
