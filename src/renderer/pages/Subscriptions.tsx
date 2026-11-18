import { useState } from 'react'
import { useUi } from '../store/ui'
import { localArtistKey, useLocalArtists } from '../store/localArtists'
import { artistsFromLibrary } from '../store/artistsLogic'
import { useLibrary } from '../store/library'
import { Cover } from '../ui/Cover'
import { SrcBadge } from '../ui/TrackRow'

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
  const service = source === 'sc' ? 'SoundCloud' : 'ВК'
  const importArtists = async () => {
    if (busy) return
    setBusy(true)
    const ui = useUi.getState()
    const localArtists = useLocalArtists.getState()
    try {
      if (source === 'sc') {
        const imported = await window.api.invoke('artists:subscriptions', 'sc')
        if (imported === null) { ui.toast('Войди в SoundCloud, чтобы импортировать артистов'); return }
        const count = localArtists.import('sc', imported)
        ui.toast(count ? `В Хвою добавлено: ${count}` : 'Новых артистов для импорта из SoundCloud нет')
        return
      }

      const [library, subscriptions] = await Promise.allSettled([
        loadVkLibraryArtists(),
        window.api.invoke('artists:subscriptions', 'vk')
      ])
      const fromLibrary = library.status === 'fulfilled' ? library.value : null
      const fromVk = subscriptions.status === 'fulfilled' ? subscriptions.value : null
      if (fromLibrary === null && fromVk === null) {
        ui.toast('Не удалось загрузить «Моё» и подписки ВК. Попробуй ещё раз')
        return
      }
      const count = localArtists.import('vk', [...(fromLibrary ?? []), ...(fromVk ?? [])])
      const result = count ? `В Хвою добавлено: ${count}` : 'Новых артистов для добавления нет'
      const unavailable = fromVk === null ? ' · Подписки ВК недоступны. Проверено «Моё»'
        : fromLibrary === null ? ' · «Моё» недоступно. Проверены подписки ВК' : ''
      ui.toast(result + unavailable)
    } catch {
      ui.toast(`Не удалось импортировать артистов из ${service}`)
    } finally { setBusy(false) }
  }
  return (
    <section className="box">
      <div className="ph">
        <h3><SrcBadge src={source} />{service}</h3><span className="sp" />
        <button className={'btn-s' + (source === 'sc' ? ' sco' : '')} disabled={busy} onClick={() => void importArtists()}>{busy ? 'Импортирую…' : `Импортировать из ${service}`}</button>
      </div>
      {!local.length ? <div className="empty-state">{source === 'vk' ? 'Импорт добавит в Хвою исполнителей из «Моего» и доступных подписок ВК.' : 'Добавь артистов на странице исполнителя или импортируй их из SoundCloud.'}</div>
        : <div className="artgrid">{local.map((artist) => (
          <button key={localArtistKey(artist)} className="art" title={`${artist.name} · подписка Хвои · ${service}`} onClick={() => useUi.getState().openArtist({ ...artist, id: artist.id || undefined, src: source })}>
            <span className="avw"><Cover className="av" url={artist.cover} seed={artist.id ? source + artist.id : localArtistKey(artist)} /></span>
            <span className="nm"><SrcBadge src={source} />{artist.name}</span>
          </button>
        ))}</div>}
    </section>
  )
}

async function loadVkLibraryArtists() {
  const mine = await useLibrary.getState().loadMine()
  if (!useLibrary.getState().mineLoaded) throw new Error('Не удалось загрузить «Моё»')
  return artistsFromLibrary(mine)
}
