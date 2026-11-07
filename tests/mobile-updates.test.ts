import { describe, it, expect } from 'vitest'
import { newerThan, apkFromRelease } from '../src/mobile/updates'

describe('сравнение версий', () => {
  it('видит, что выпуск новее', () => {
    expect(newerThan('0.4.23', '0.4.22')).toBe(true)
    expect(newerThan('0.5.0', '0.4.22')).toBe(true)
    expect(newerThan('1.0.0', '0.9.9')).toBe(true)
  })
  it('не считает новее то же самое или старое', () => {
    expect(newerThan('0.4.22', '0.4.22')).toBe(false)
    expect(newerThan('0.4.21', '0.4.22')).toBe(false)
    expect(newerThan('0.4.9', '0.4.22')).toBe(false) // 9 < 22, а не наоборот по алфавиту
  })
  it('буква v спереди не мешает', () => {
    expect(newerThan('v0.4.23', '0.4.22')).toBe(true)
  })
})

describe('поиск apk в выпуске', () => {
  const rel = (assets: string[], tag = 'v0.4.23') => ({ tag_name: tag, assets: assets.map((name) => ({ name, browser_download_url: `https://x/${name}` })) })

  it('находит apk среди файлов выпуска', () => {
    const got = apkFromRelease(rel(['Khvoya-Setup-0.4.23.exe', 'latest.yml', 'Khvoya-0.4.23.apk']), '0.4.22')
    expect(got).toEqual({ version: '0.4.23', url: 'https://x/Khvoya-0.4.23.apk' })
  })
  it('нет apk — нечего ставить', () => {
    expect(apkFromRelease(rel(['Khvoya-Setup-0.4.23.exe']), '0.4.22')).toBeNull()
  })
  it('выпуск не новее — молчим', () => {
    expect(apkFromRelease(rel(['Khvoya-0.4.22.apk'], 'v0.4.22'), '0.4.22')).toBeNull()
  })
  it('мусор вместо ответа не роняет проверку', () => {
    expect(apkFromRelease(null, '0.4.22')).toBeNull()
    expect(apkFromRelease({} as never, '0.4.22')).toBeNull()
  })
})
