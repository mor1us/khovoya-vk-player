/** Единый список каналов между окном и главным процессом. Всё, чего здесь нет, мост отбрасывает. */
export const IPC = {
  'auth:login': true, 'auth:logout': true, 'auth:session': true,
  'vk:myTracks': true, 'vk:search': true, 'vk:playlists': true, 'vk:playlistTracks': true,
  'vk:recommendations': true, 'vk:popular': true, 'vk:byId': true, 'vk:add': true, 'vk:remove': true,
  'pl:create': true, 'pl:edit': true, 'pl:addTracks': true, 'pl:removeTracks': true, 'pl:delete': true, 'pl:reorder': true,
  'dl:start': true, 'dl:list': true, 'dl:cancel': true, 'dl:localPath': true, 'dl:openFolder': true,
  'settings:get': true, 'settings:set': true,
  'wave:get': true, 'wave:set': true,
  'win:min': true, 'win:max': true, 'win:close': true,
  'discord:update': true
} as const

export const EVENTS = { 'sys:state': true, 'auth:lost': true, 'dl:changed': true, 'tray:cmd': true } as const

export type Channel = keyof typeof IPC
export type EventName = keyof typeof EVENTS

export function isAllowedChannel(c: unknown): c is Channel {
  return typeof c === 'string' && Object.prototype.hasOwnProperty.call(IPC, c)
}
export function isAllowedEvent(c: unknown): c is EventName {
  return typeof c === 'string' && Object.prototype.hasOwnProperty.call(EVENTS, c)
}
