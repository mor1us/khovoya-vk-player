// ВЫБРАСЫВАЕМЫЙ КОД (проверка переносимости на Android). Заглушка вместо window.api:
// окно думает, что говорит с главным процессом, а на самом деле с этим файлом в том же браузере.
import { coverSvg } from '../../src/main/vk/mock'
import type { Track, Playlist } from '../../src/shared/types'

const ARTISTS = ['Северный ветер', 'Мира Лин', 'Дворы', 'Ночной трамвай', 'Лес и бетон']
const WORDS = ['Холодный свет', 'Неон над городом', 'Тихий шум', 'Космос в окне', 'Кислота', 'Пламя', 'Глубина']
const track = (i: number): Track => ({
  id: `100_${i + 1}`, ownerId: 100, vkId: i + 1,
  title: WORDS[i % WORDS.length] + (i >= WORDS.length ? ` ${Math.floor(i / WORDS.length) + 1}` : ''),
  artist: ARTISTS[(i * 3) % ARTISTS.length], duration: 180, url: '', coverUrl: coverSvg(i),
  addedAt: 1_700_000_000 - i * 3600, available: true
})
const tracks = Array.from({ length: 60 }, (_, i) => track(i))
const pl = (id: number, title: string): Playlist => ({ id, ownerId: 100, title, count: 20, coverUrls: [coverSvg(id)], isMine: true, updatedAt: 1_700_000_000 })

const calls: string[] = []
const table: Record<string, (...a: any[]) => any> = {
  'auth:session': () => ({ loggedIn: true, userName: 'Мориус', userId: 100 }),
  'auth:browser': () => ({ kind: 'ok', userName: 'Мориус' }),
  'auth:logout': () => undefined,
  'vk:myTracks': () => tracks,
  'vk:search': () => ({ tracks: tracks.slice(0, 20), playlists: [pl(1, 'Найденный плейлист')] }),
  'vk:playlists': () => [pl(1, 'Для бега'), pl(2, 'Ночь')],
  'vk:playlistTracks': () => tracks.slice(0, 20),
  'vk:recommendations': () => tracks.slice(10, 40),
  'vk:popular': () => tracks.slice(0, 30),
  'vk:forYou': () => [{ title: 'Для вас', big: true, playlists: [pl(3, 'Подборка')] }],
  'vk:artistTracks': () => tracks.slice(0, 15),
  'vk:byId': () => tracks.slice(0, 3),
  'pl:create': () => pl(9, 'Новый'),
  'sc:search': () => [],
  'sc:related': () => [],
  'sc:status': () => ({ ok: false, message: 'SoundCloud недоступен (заглушка)', hasKey: false }),
  'sc:prepare': () => ({ ok: false, message: 'заглушка', hasKey: false }),
  'sc:suggest': () => [],
  'sc:users': () => [],
  'sc:searchPlaylists': () => [],
  'sc:waveform': () => [],
  'sc:comments': () => [],
  'scacc:me': () => null,
  'scacc:likes': () => [],
  'scacc:playlists': () => [],
  'scacc:playlistTracks': () => [],
  'scacc:feed': () => [],
  'scl:get': () => [],
  'lpl:get': () => [],
  'wave:get': () => null,
  'dl:list': () => [],
  'dl:localPath': () => null,
  'settings:get': () => ({ downloadDir: '/sdcard/Music', closeToTray: false, animations: true, discordEnabled: false, discordAppId: '', crossfadeSec: 4, scComments: false }),
  'settings:set': () => ({ downloadDir: '/sdcard/Music', closeToTray: false, animations: true, discordEnabled: false, discordAppId: '', crossfadeSec: 4, scComments: false }),
  'settings:pickDir': () => null,
  'upd:state': () => ({ stage: 'idle' }),
  'upd:check': () => ({ stage: 'idle' })
}

;(window as any).api = {
  invoke(channel: string, ...args: unknown[]) {
    calls.push(channel)
    const f = table[channel]
    if (!f) { ;(window as any).__unstubbed = ((window as any).__unstubbed ?? []).concat(channel); return Promise.resolve(undefined) }
    try { return Promise.resolve(f(...(args as any[]))) } catch (e) { return Promise.reject(e) }
  },
  on() { return () => {} }
}
;(window as any).__calls = calls
// Всё, что окно уронит, собираем — иначе в отчёте будет только «не работает».
;(window as any).__errors = []
window.addEventListener('error', (e) => (window as any).__errors.push(String(e.message)))
window.addEventListener('unhandledrejection', (e: any) => (window as any).__errors.push('promise: ' + String(e.reason?.message ?? e.reason)))
