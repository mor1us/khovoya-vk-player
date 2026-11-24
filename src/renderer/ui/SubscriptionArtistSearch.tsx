import { useEffect, useRef, useState } from 'react'
import { matchVkArtists } from '../store/artistsLogic'
import { localArtistKey, mergeLocalArtists, type LocalArtist } from '../store/localArtists'
import { useUi } from '../store/ui'
import { Cover } from './Cover'
import { SrcBadge } from './TrackRow'
import { IX } from './icons'

type Source = LocalArtist['source']
const SEARCH_INTERVAL_MS = 250

export function SubscriptionArtistSearch({ source, service }: { source: Source; service: string }) {
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const query = text.trim()
  const label = `Поиск исполнителей в ${service}`
  return (
    <div className="subscription-search">
      <div className="subscription-search-field">
        <input ref={input} className="field" type="search" aria-label={label} placeholder={label} value={text} onChange={(e) => setText(e.target.value)} />
        {text && <button type="button" className="ic subscription-search-clear" title="Очистить поиск"
          aria-label={'Очистить поиск исполнителей в ' + service} onClick={() => { setText(''); input.current?.focus() }}>
          <IX size={14} />
        </button>}
      </div>
      {query && <ArtistMatches source={source} service={service} query={query} />}
    </div>
  )
}

function ArtistMatches({ source, service, query }: { source: Source; service: string; query: string }) {
  const [result, setResult] = useState<{ source: Source; query: string; artists: LocalArtist[] | null }>()
  const lastStarted = useRef(-Infinity)
  useEffect(() => {
    let active = true
    const timer = setTimeout(async () => {
      lastStarted.current = performance.now()
      try {
        const found = source === 'vk'
          ? matchVkArtists(await window.api.invoke('vk:artistSearch', query), query)
          : (await window.api.invoke('sc:users', query, 12, true)).map((a) => ({ id: a.id ?? '', name: a.name, cover: a.avatar, link: a.link }))
        const matches = mergeLocalArtists([], found.map((artist) => ({ ...artist, source })))
        if (active) setResult({ source, query, artists: matches.slice(0, 12) })
      } catch {
        if (active) setResult({ source, query, artists: null })
      }
    }, Math.max(0, lastStarted.current + SEARCH_INTERVAL_MS - performance.now()))
    return () => { active = false; clearTimeout(timer) }
  }, [source, query])

  if (result?.source !== source || result.query !== query) return <p role="status">Ищу исполнителей…</p>
  const { artists } = result
  if (!artists) return <p role="status">Не удалось поискать исполнителей в {service}</p>
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
