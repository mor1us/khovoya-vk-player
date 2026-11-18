import { useEffect, useState } from 'react'
import { matchVkArtists } from '../store/artistsLogic'
import { localArtistKey, mergeLocalArtists, type LocalArtist } from '../store/localArtists'
import { useUi } from '../store/ui'
import { Cover } from './Cover'
import { SrcBadge } from './TrackRow'

type Source = LocalArtist['source']

export function SubscriptionArtistSearch({ source, service }: { source: Source; service: string }) {
  const [text, setText] = useState('')
  const query = text.trim()
  const label = `Поиск исполнителей в ${service}`
  return (
    <div className="subscription-search">
      <input className="field" type="search" aria-label={label} placeholder={label} value={text} onChange={(e) => setText(e.target.value)} />
      {query && <ArtistMatches key={query} source={source} service={service} query={query} />}
    </div>
  )
}

function ArtistMatches({ source, service, query }: { source: Source; service: string; query: string }) {
  const [artists, setArtists] = useState<LocalArtist[] | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      try {
        const found = source === 'vk'
          ? matchVkArtists((await window.api.invoke('vk:search', query)).tracks, query)
          : (await window.api.invoke('sc:users', query, 12)).map((a) => ({ id: a.id ?? '', name: a.name, cover: a.avatar, link: a.link }))
        const matches = mergeLocalArtists([], found.map((artist) => ({ ...artist, source })))
        if (active) setArtists(matches.slice(0, 12))
      } catch {
        if (active) setFailed(true)
      }
    }, 300)
    return () => { active = false; clearTimeout(timer) }
  }, [source, query])

  if (failed) return <p role="status">Не удалось поискать исполнителей в {service}</p>
  if (!artists) return <p role="status">Ищу исполнителей…</p>
  if (!artists.length) return <p role="status">Исполнители не найдены</p>

  return (
    <div className="artists" role="group" aria-label={`Найденные исполнители в ${service}`}>
      {artists.map((artist) => (
        <button key={localArtistKey(artist)} className={source} onClick={() => useUi.getState().openArtist({ ...artist, id: artist.id || undefined, src: source })}>
          <Cover className="av" url={artist.cover} seed={localArtistKey(artist)} />
          <SrcBadge src={source} />{artist.name}
        </button>
      ))}
    </div>
  )
}
