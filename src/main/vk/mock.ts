import type { Track, Playlist } from '../../shared/types'
import type { AudioApi } from './audio'

/** Поддельный ВК для разработки без аккаунта (VK_MOCK=1). Звук — локальные тестовые mp3. */
const ARTISTS = ['Северный ветер', 'Мира Лин', 'Дворы', 'Ночной трамвай', 'Лес и бетон', 'Отражения', 'Кислотный дождь', 'Пятый этаж', 'Неон', 'Тихий берег']
const WORDS = ['Холодный свет', 'Неон над городом', 'Тихий шум', 'Космос в окне', 'Кислота', 'Пламя', 'Глубина', 'Розовый дым', 'Лето в бетоне', 'Ночь', 'Провода', 'Волны', 'Сигнал', 'Мост', 'Пустой трамвай', 'Электричка', 'Туман', 'Двор', 'Огни', 'Север']
const SHAPES = ['circle', 'half', 'stripes', 'ring', 'bars', 'dot']

export function coverSvg(seed: number): string {
  const g = '#39FF14', k = '#0B0B0B'
  const s = SHAPES[seed % SHAPES.length]
  const body = {
    circle: `<rect width="100" height="100" fill="${g}"/><circle cx="50" cy="50" r="30" fill="${k}"/>`,
    half: `<rect width="100" height="100" fill="${k}"/><rect width="100" height="50" fill="${g}"/>`,
    stripes: `<rect width="100" height="100" fill="${k}"/>${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${i * 20 - 10}" y="-20" width="6" height="160" fill="${g}" transform="rotate(30 50 50)"/>`).join('')}`,
    ring: `<rect width="100" height="100" fill="${g}"/><circle cx="50" cy="50" r="34" fill="none" stroke="${k}" stroke-width="10"/>`,
    bars: `<rect width="100" height="100" fill="${k}"/><rect x="10" y="10" width="25" height="80" fill="${g}"/><rect x="65" y="10" width="25" height="80" fill="${g}"/>`,
    dot: `<rect width="100" height="100" fill="#1B1B1B"/><circle cx="${30 + (seed % 40)}" cy="60" r="18" fill="${g}"/>`
  }[s]
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${body}</svg>`)
}

export class MockAudioApi implements AudioApi {
  private all: Track[]
  private mine: Track[]
  private pls: { p: Playlist; ids: string[] }[]
  private nextPl = 100

  constructor(private mediaBase: string) {
    this.all = Array.from({ length: 320 }, (_, i) => ({
      id: `100_${i + 1}`, ownerId: 100, vkId: i + 1,
      title: WORDS[i % WORDS.length] + (i >= WORDS.length ? ` ${Math.floor(i / WORDS.length) + 1}` : ''),
      artist: ARTISTS[(i * 7) % ARTISTS.length],
      duration: 40,
      url: i % 37 === 36 ? '' : `${mediaBase}/tone${i % 6}.mp3`,
      coverUrl: i % 11 === 10 ? undefined : coverSvg(i),
      addedAt: 1_700_000_000 - i * 3600,
      available: i % 37 !== 36
    }))
    this.mine = this.all.slice(0, 200)
    const names = ['Для качалки', 'Фонк', 'Ночь', 'В дорогу', 'Катки с пацанами', 'Новое за неделю']
    this.pls = names.map((title, n) => {
      const ids = this.mine.filter((_, i) => i % (n + 3) === 0).map((t) => t.id)
      return { p: { id: n + 1, ownerId: 1, title, count: ids.length, coverUrls: [coverSvg(n), coverSvg(n + 1), coverSvg(n + 2)], isMine: n < 5, updatedAt: 0 }, ids }
    })
  }
  private byIds(ids: string[]) { return ids.map((id) => this.all.find((t) => t.id === id.split('_').slice(0, 2).join('_'))).filter(Boolean) as Track[] }
  private find(p: Playlist) { const x = this.pls.find((x) => x.p.id === p.id); if (!x) throw new Error('Плейлист не найден'); return x }
  private sync(x: { p: Playlist; ids: string[] }) { x.p.count = x.ids.length }

  async myTracks() { return [...this.mine] }
  async search(q: string) {
    const s = q.toLowerCase()
    return { tracks: this.all.filter((t) => (t.artist + ' ' + t.title).toLowerCase().includes(s)), playlists: this.pls.filter((x) => x.p.title.toLowerCase().includes(s)).map((x) => x.p) }
  }
  async playlists() { return this.pls.map((x) => ({ ...x.p })) }
  async playlistTracks(p: Playlist) { return this.byIds(this.find(p).ids) }
  async recommendations(target?: string, count = 50) {
    const seed = target ? Number(target.split('_')[1]) : 7
    return this.all.slice(150).filter((_, i) => (i + seed) % 3 !== 0).slice(0, count)
  }
  async popular() { return this.all.slice(200, 260) }
  async byId(ids: string[]) { return this.byIds(ids) }
  async add(t: Track) { if (!this.mine.some((m) => m.id === t.id)) this.mine.unshift(t) }
  async remove(t: Track) { this.mine = this.mine.filter((m) => m.id !== t.id) }
  async createPlaylist(title: string) {
    const p: Playlist = { id: this.nextPl++, ownerId: 1, title, count: 0, coverUrls: [], isMine: true, updatedAt: Date.now() / 1000 }
    this.pls.unshift({ p, ids: [] }); return { ...p }
  }
  async editPlaylist(p: Playlist, title: string) { this.find(p).p.title = title }
  async addToPlaylist(p: Playlist, ids: string[]) { const x = this.find(p); x.ids.push(...ids.filter((i) => !x.ids.includes(i))); this.sync(x) }
  async removeFromPlaylist(p: Playlist, ids: string[]) { const x = this.find(p); x.ids = x.ids.filter((i) => !ids.includes(i)); this.sync(x) }
  async deletePlaylist(p: Playlist) { this.pls = this.pls.filter((x) => x.p.id !== p.id) }
  async reorder(t: Track, before?: string, after?: string) {
    const i = this.mine.findIndex((m) => m.id === t.id); if (i < 0) return
    const [m] = this.mine.splice(i, 1)
    const anchor = before ?? after
    let j = anchor ? this.mine.findIndex((x) => x.id === anchor) : 0
    if (after && j >= 0) j += 1
    this.mine.splice(Math.max(0, j), 0, m)
  }
}
