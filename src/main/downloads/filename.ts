const RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
const MAX = 150

function clean(s: string, fallback: string): string {
  let x = s.replace(/[\u0000-\u001f\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '')
  if (!x) x = fallback
  return x
}

/** «Исполнитель - Название.mp3», безопасное для Windows. */
export function safeFileName(artist: string, title: string): string {
  const a = clean(artist, 'Неизвестен'), t = clean(title, 'Без названия')
  let base = `${RESERVED.test(a) ? '_' + a : a} - ${t}`
  if (base.length > MAX) base = base.slice(0, MAX).replace(/[. ]+$/g, '')
  return base + '.mp3'
}

export function uniqueName(name: string, exists: (n: string) => boolean): string {
  if (!exists(name)) return name
  const stem = name.replace(/\.mp3$/i, '')
  for (let i = 2; ; i++) { const n = `${stem} (${i}).mp3`; if (!exists(n)) return n }
}
