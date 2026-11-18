import { useState } from 'react'
import { useUi } from '../store/ui'
import { localArtistKey, useLocalArtists } from '../store/localArtists'
import { Cover } from '../ui/Cover'
import { SrcBadge } from '../ui/TrackRow'
import { SubscriptionArtistSearch } from '../ui/SubscriptionArtistSearch'
import { confirmAsk } from '../ui/Dialog'
import { ICheck } from '../ui/icons'

type Source = 'vk' | 'sc'

export function Subscriptions() {
  return (
    <div className="page">
      <div className="ph"><h1>Мои подписки</h1></div>
      <SubscriptionGroup source="vk" />
      <SubscriptionGroup source="sc" />
    </div>
  )
}
function SubscriptionGroup({ source }: { source: Source }) {
  const local = useLocalArtists((s) => s.artists).filter((artist) => artist.source === source)
  const [busy, setBusy] = useState(false)
  const [selection, setSelection] = useState<Set<string> | null>(null)
  const selected = local.filter((artist) => selection?.has(localArtistKey(artist)))
  const service = source === 'sc' ? 'SoundCloud' : 'ВК'
  const importArtists = async () => {
    if (busy) return
    setBusy(true)
    const ui = useUi.getState()
    try {
      const imported = await window.api.invoke('artists:subscriptions', source)
      if (imported === null) {
        ui.toast(`Войди в ${service}, чтобы импортировать подписки`)
        return
      }
      const count = useLocalArtists.getState().import(source, imported)
      ui.toast(count ? `В Хвою добавлено: ${count}` : `Новых подписок для импорта из ${service} нет`)
    } catch {
      ui.toast(`Не удалось загрузить подписки из ${service}. Артистов можно добавить через поиск`)
    } finally { setBusy(false) }
  }

  const toggleSelected = (key: string) => setSelection((current) => {
    if (!current) return current
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const removeSelected = async () => {
    if (!selected.length || !await confirmAsk(`Удалить выбранные подписки из Хвои (${selected.length})?`, 'Удалить', true)) return
    const removed = useLocalArtists.getState().removeMany(selected.map(localArtistKey))
    setSelection(null)
    if (removed) useUi.getState().toast(`Из Хвои удалено: ${removed}`)
  }

  return (
    <section className="box">
      <div className="ph">
        <h3><SrcBadge src={source} />{service}</h3><span className="sp" />
        {selection ? <>
          <button className="btn-s" disabled={!local.length} onClick={() => setSelection(selected.length === local.length ? new Set() : new Set(local.map(localArtistKey)))}>{selected.length === local.length ? 'Снять выделение' : 'Выбрать всех'}</button>
          <button className="btn-s bad" disabled={!selected.length} onClick={() => void removeSelected()}>Удалить{selected.length ? ` (${selected.length})` : ''}</button>
          <button className="btn-s" onClick={() => setSelection(null)}>Отмена</button>
        </> : <>
          {local.length > 0 && <button className="btn-s" disabled={busy} onClick={() => setSelection(new Set())}>Выбрать артистов</button>}
          <button className={'btn-s' + (source === 'sc' ? ' sco' : '')} disabled={busy} onClick={() => void importArtists()}>{busy ? 'Импортирую…' : `Импортировать из ${service}`}</button>
        </>}
      </div>
      <SubscriptionArtistSearch source={source} service={service} />
      {!local.length ? <div className="empty-state">Найди исполнителя и подпишись в Хвое или импортируй подписки из {service}.</div>
        : <div className="artgrid">{local.map((artist) => {
          const key = localArtistKey(artist)
          return (
            <button key={key} className="art" aria-pressed={selection?.has(key)} title={artist.name} onClick={() => {
              if (selection) toggleSelected(key)
              else useUi.getState().openArtist({ ...artist, id: artist.id || undefined, src: source })
            }}>
              <span className="avw">
                <Cover className="av" url={artist.cover} seed={artist.id ? source + artist.id : key} />
                {selection && <span className="artist-selection" aria-hidden="true">{selection.has(key) && <ICheck size={12} />}</span>}
              </span>
              <span className="nm"><SrcBadge src={source} />{artist.name}</span>
            </button>
          )
        })}</div>}
    </section>
  )
}
