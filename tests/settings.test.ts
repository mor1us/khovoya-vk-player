import { describe, it, expect } from 'vitest'
import { normalizeSettings, defaultSettings } from '../src/main/system/settingsLogic'

describe('settings', () => {
  const d = defaultSettings('/music/Хвоя')
  it('defaults', () => {
    expect(d).toEqual({ downloadDir: '/music/Хвоя', closeToTray: true, animations: true, discordEnabled: true, discordAppId: '', crossfadeSec: 3, scComments: true })
  })
  it('drops unknown fields and wrong types', () => {
    const s = normalizeSettings({ hacker: 1, closeToTray: 'yes', crossfadeSec: '9' } as any, d)
    expect(s).not.toHaveProperty('hacker')
    expect(s.closeToTray).toBe(true)
    expect(s.crossfadeSec).toBe(3)
  })
  it('clamps crossfade to 0..12 and rounds', () => {
    expect(normalizeSettings({ crossfadeSec: 40 }, d).crossfadeSec).toBe(12)
    expect(normalizeSettings({ crossfadeSec: -3 }, d).crossfadeSec).toBe(0)
    expect(normalizeSettings({ crossfadeSec: 4.6 }, d).crossfadeSec).toBe(5)
  })
  it('keeps valid values, trims app id to digits, empty dir falls back', () => {
    const s = normalizeSettings({ closeToTray: false, discordAppId: ' 12345abc ', downloadDir: '   ' }, d)
    expect(s.closeToTray).toBe(false); expect(s.discordAppId).toBe('12345'); expect(s.downloadDir).toBe('/music/Хвоя')
  })
  it('null/garbage input → defaults', () => { expect(normalizeSettings(null, d)).toEqual(d); expect(normalizeSettings('x' as any, d)).toEqual(d) })
})
import { migrateSettings } from '../src/main/system/settingsLogic'
describe('migrateSettings', () => {
  it('old defaults 6 s / 4 s → 3 s once', () => {
    expect(migrateSettings({ crossfadeSec: 6 }, {})).toEqual({ settings: { crossfadeSec: 3 }, migrations: { cf4: true, cf3: true } })
    expect(migrateSettings({ crossfadeSec: 4 }, { cf4: true })).toEqual({ settings: { crossfadeSec: 3 }, migrations: { cf4: true, cf3: true } })
    expect(migrateSettings({ crossfadeSec: 4 }, { cf4: true, cf3: true })).toEqual({ settings: { crossfadeSec: 4 }, migrations: { cf4: true, cf3: true } })
    expect(migrateSettings({ crossfadeSec: 9 }, {})).toEqual({ settings: { crossfadeSec: 9 }, migrations: { cf4: true, cf3: true } })
  })
})
