import { useEffect, useState } from 'react'
import type { Track } from '../../shared/types'

export type Suggest =
  | { kind: 'search'; q: string }
  | { kind: 'artist'; name: string; cover?: string; seed: string; src: 'vk' | 'sc'; followers?: number }
  | { kind: 'track'; track: Track }
  | { kind: 'query'; q: string; fromHistory: boolean }

/** Что показать под строкой поиска, пока печатаешь: артисты, треки, варианты запроса. */
export type ScArtist = { name: string; avatar?: string; followers: number }

export function buildSuggest(q: string, vk: Track[], sc: string[], history: string[], scArtists: ScArtist[] = []): Suggest[] {
  const low = q.trim().toLowerCase()
  if (!low) return []
  const out: Suggest[] = [{ kind: 'search', q: q.trim() }]
  const artists = new Map<string, Track>()
  for (const t of vk) {
    const names = t.artists?.length ? t.artists.map((a) => a.name) : [t.artist]
    for (const n of names) if (n.toLowerCase().includes(low) && !artists.has(n.toLowerCase())) artists.set(n.toLowerCase(), { ...t, artist: n })
  }
  const shown = new Set<string>()
  for (const t of [...artists.values()].slice(0, 2)) { shown.add(t.artist.toLowerCase()); out.push({ kind: 'artist', name: t.artist, cover: t.coverUrl, seed: t.id, src: 'vk' }) }
  for (const a of scArtists.filter((a) => !shown.has(a.name.toLowerCase())).slice(0, 2)) out.push({ kind: 'artist', name: a.name, cover: a.avatar, seed: 'sca' + a.name, src: 'sc', followers: a.followers })
  for (const t of vk.filter((t) => t.available).slice(0, 3)) out.push({ kind: 'track', track: t })
  const seen = new Set([low])
  const qs = [...history.filter((h) => h.toLowerCase().includes(low)).slice(0, 2).map((x) => ({ q: x, h: true })), ...sc.map((x) => ({ q: x, h: false }))]
  for (const x of qs) { const k = x.q.toLowerCase(); if (seen.has(k)) continue; seen.add(k); out.push({ kind: 'query', q: x.q, fromHistory: x.h }); if (out.filter((o) => o.kind === 'query').length >= 6) break }
  return out
}

/** Подсказки с паузой 300 мс после последней буквы — чтобы не дёргать ВК на каждую букву. */
export function useSuggest(q: string, open: boolean): Suggest[] {
  const [items, setItems] = useState<Suggest[]>([])
  useEffect(() => {
    const text = q.trim()
    if (!open || !text || /^https?:\/\//i.test(text)) { setItems(text ? [{ kind: 'search', q: text }] : []); return }
    // строка «Искать …» всегда с тем, что сейчас в поле; остальное обновится после паузы
    setItems((prev) => [{ kind: 'search', q: text }, ...prev.filter((x) => x.kind !== 'search')])
    let alive = true
    const tm = setTimeout(async () => {
      const hist = JSON.parse(localStorage.getItem('searchHistory') ?? '[]') as string[]
      // ВК показываем сразу, SoundCloud догружаем — без VPN в России он может не ответить
      const scP = Promise.all([
        window.api.invoke<string[]>('sc:suggest', text).catch(() => [] as string[]),
        window.api.invoke<ScArtist[]>('sc:users', text).catch(() => [] as ScArtist[])
      ])
      const vk = await window.api.invoke<{ tracks: Track[] }>('vk:search', text).then((r) => r.tracks).catch(() => [] as Track[])
      if (!alive) return
      setItems(buildSuggest(text, vk, [], hist, []))
      const [sc, users] = await scP
      if (alive && (sc.length || users.length)) setItems(buildSuggest(text, vk, sc, hist, users))
    }, 300)
    return () => { alive = false; clearTimeout(tm) }
  }, [q, open])
  return items
}
