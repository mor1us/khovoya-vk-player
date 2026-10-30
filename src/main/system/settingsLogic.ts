import type { Settings } from '../../shared/types'

export const defaultSettings = (downloadDir: string): Settings => ({
  downloadDir, closeToTray: true, animations: true, discordEnabled: true, discordAppId: '', crossfadeSec: 6
})

/** Только известные поля правильного типа; кроссфейд 0..12. */
export function normalizeSettings(input: unknown, def: Settings): Settings {
  const x = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const bool = (k: keyof Settings) => (typeof x[k] === 'boolean' ? (x[k] as boolean) : (def[k] as boolean))
  const cf = typeof x.crossfadeSec === 'number' && Number.isFinite(x.crossfadeSec) ? Math.round(Math.min(12, Math.max(0, x.crossfadeSec))) : def.crossfadeSec
  const dir = typeof x.downloadDir === 'string' && x.downloadDir.trim() ? x.downloadDir.trim() : def.downloadDir
  const appId = typeof x.discordAppId === 'string' ? x.discordAppId.replace(/\D/g, '').slice(0, 25) : def.discordAppId
  return { downloadDir: dir, closeToTray: bool('closeToTray'), animations: bool('animations'), discordEnabled: bool('discordEnabled'), discordAppId: appId, crossfadeSec: cf }
}
