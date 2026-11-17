import { useUi } from '../store/ui'

/** Главное имя до «feat.», «&» и запятой — его и ищем у ВК и SoundCloud. */
export const mainName = (s: string) => s.split(/\s+(?:feat\.?|ft\.?|x|&)\s+|,/i)[0].trim()

/**
 * Имя исполнителя кликабельно: открывает его экран. Несколько имён через запятую — каждое своё.
 * Источник важен: у трека SoundCloud открываем артиста SoundCloud, иначе ВК.
 */
export function Artists({ names, src, id, profileName, artists = [] }: { names: string; src?: string; id?: string; profileName?: string; artists?: { id: string; name: string }[] }) {
  const list = src === 'sc' ? [names] : names.split(/,\s*/).filter(Boolean)
  const open = (name: string) => {
    const primary = src === 'sc' ? profileName || name : mainName(name)
    const match = artists.find((a) => mainName(a.name).toLowerCase() === primary.toLowerCase())
    useUi.getState().openArtist({ name: primary, id: match?.id ?? (list.length === 1 ? id : undefined), src: src === 'sc' ? 'sc' : 'vk' })
  }
  return (
    <>{list.map((name, i) => (
      <span key={name + i}>{i > 0 && ', '}
        <button className="artlink" title={`Открыть ${name}`} onClick={(e) => { e.stopPropagation(); open(name) }}>{name}</button>
      </span>
    ))}</>
  )
}
