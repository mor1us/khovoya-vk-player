import { describe, it, expect } from 'vitest'
import { VkAudioApi } from '../src/main/vk/audio'
import { MockAudioApi } from '../src/main/vk/mock'
import type { AudioApi } from '../src/main/vk/audio'

const raw = (i: number) => ({ owner_id: 7, id: i, artist: 'A' + (i % 5), title: 'T' + i, duration: 120, url: 'https://u/' + i })

function fakeClient(handler: (m: string, p: Record<string, any>) => unknown) {
  const calls: { m: string; p: Record<string, any> }[] = []
  return { calls, client: { call: async (m: string, p: Record<string, any>) => { calls.push({ m, p }); return handler(m, p) } } }
}

describe('VkAudioApi', () => {
  it('myTracks pages audio.get by 1000 and concatenates', async () => {
    const { calls, client } = fakeClient((_m, p) => {
      const off = Number(p.offset); const n = Math.min(1000, 2500 - off)
      return { count: 2500, items: Array.from({ length: n }, (_, k) => raw(off + k)) }
    })
    const api = new VkAudioApi(client as any, () => 7)
    const tracks = await api.myTracks()
    expect(tracks.length).toBe(2500)
    expect(calls.map((c) => c.p.offset)).toEqual([0, 1000, 2000])
    expect(calls.every((c) => c.m === 'audio.get' && c.p.owner_id === 7)).toBe(true)
  })
  it('recommendations passes target_audio', async () => {
    const { calls, client } = fakeClient(() => ({ items: [raw(1)] }))
    await new VkAudioApi(client as any, () => 7).recommendations('1_2', 30)
    expect(calls[0]).toMatchObject({ m: 'audio.getRecommendations', p: { target_audio: '1_2', count: 30 } })
  })
  it('addToPlaylist joins ids with comma', async () => {
    const { calls, client } = fakeClient(() => 1)
    await new VkAudioApi(client as any, () => 7).addToPlaylist({ id: 3, ownerId: 7 } as any, ['7_1', '7_2'])
    expect(calls[0]).toMatchObject({ m: 'audio.addToPlaylist', p: { owner_id: 7, playlist_id: 3, audio_ids: '7_1,7_2' } })
  })
  it('byId joins access keys', async () => {
    const { calls, client } = fakeClient(() => [raw(1)])
    await new VkAudioApi(client as any, () => 7).byId(['7_1_abc', '7_2'])
    expect(calls[0]).toMatchObject({ m: 'audio.getById', p: { audios: '7_1_abc,7_2' } })
  })
  it('playlistTracks uses playlist owner, id and access key', async () => {
    const { calls, client } = fakeClient(() => ({ count: 1, items: [raw(1)] }))
    await new VkAudioApi(client as any, () => 7).playlistTracks({ id: 5, ownerId: -3, accessKey: 'k' } as any)
    expect(calls[0]).toMatchObject({ m: 'audio.get', p: { owner_id: -3, playlist_id: 5, access_key: 'k' } })
  })
})

async function contract(api: AudioApi) {
  const mine = await api.myTracks()
  expect(mine.length).toBeGreaterThan(50)
  expect(new Set(mine.map((t) => t.id)).size).toBe(mine.length)
  const pls = await api.playlists()
  expect(pls.length).toBeGreaterThanOrEqual(6)
  const pt = await api.playlistTracks(pls[0])
  expect(pt.length).toBe(pls[0].count)
  const created = await api.createPlaylist('Новый')
  await api.addToPlaylist(created, [mine[0].id, mine[1].id])
  expect((await api.playlistTracks(created)).map((t) => t.id)).toEqual([mine[0].id, mine[1].id])
  await api.removeFromPlaylist(created, [mine[0].id])
  expect((await api.playlistTracks(created)).length).toBe(1)
  const s = await api.search(mine[3].artist)
  expect(s.tracks.length).toBeGreaterThan(0)
  expect((await api.recommendations(mine[0].id)).length).toBeGreaterThan(0)
}
describe('MockAudioApi', () => {
  it('passes the same contract', async () => { await contract(new MockAudioApi('http://127.0.0.1:1')) })
})

describe('artistTracks', () => {
  it('by id → audio.getAudiosByArtist, newest first', async () => {
    const { calls, client } = fakeClient(() => ({ items: [{ ...raw(1), date: 100 }, { ...raw(2), date: 300 }] }))
    const r = await new VkAudioApi(client as any, () => 7).artistTracks({ id: 'abc', name: 'A' })
    expect(calls[0]).toMatchObject({ m: 'audio.getAudiosByArtist', p: { artist_id: 'abc' } })
    expect(r.map((t) => t.vkId)).toEqual([2, 1])
  })
  it('without id → search by name, only that artist, newest first', async () => {
    const { calls, client } = fakeClient(() => ({ items: [{ ...raw(1), artist: 'Дворы', date: 5 }, { ...raw(2), artist: 'Другие', date: 9 }, { ...raw(3), artist: 'Дворы feat. X', date: 7 }] }))
    const r = await new VkAudioApi(client as any, () => 7).artistTracks({ name: 'Дворы' })
    expect(calls[0].m).toBe('audio.search')
    expect(r.map((t) => t.vkId)).toEqual([3, 1])
  })
})

describe('листание страниц', () => {
  it('без поля count не уходит в вечный цикл', async () => {
    // ВК обязан присылать count, но если не прислал — лучше отдать что есть,
    // чем долбить его запросами до бесконечности
    let calls = 0
    const vk = { call: async () => { calls++; return { items: [{ id: calls, owner_id: 1, title: 'Т', artist: 'А', duration: 1, url: 'https://x/a.mp3' }] } } }
    const api = new VkAudioApi(vk as never, () => 1)
    const got = await api.myTracks()
    expect(calls).toBe(1)
    expect(got.length).toBe(1)
  })
})
