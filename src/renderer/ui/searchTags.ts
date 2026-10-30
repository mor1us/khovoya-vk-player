/** Быстрые теги (жанры и настроение) — ищутся как есть. */
export const TAGS = ['фонк', 'рэп', 'lo-fi', 'рок', 'поп', 'электроника', 'хип-хоп', 'инди', 'грустное', 'для качалки', 'ночной вайб', 'в дорогу', 'новинки', 'русский рэп', 'drill', 'hyperpop']

/** Ключевые слова-уточнения, которые дописываются к запросу. */
export const KEYWORDS: { label: string; q: string }[] = [
  { label: 'Slowed', q: 'slowed' }, { label: 'Speed up', q: 'speed up' }, { label: 'Remix', q: 'remix' },
  { label: 'Live', q: 'live' }, { label: 'Instrumental', q: 'instrumental' }, { label: 'Cover', q: 'cover' }
]

export const cleanQuery = (q: string) => q.replace(/#/g, ' ').replace(/\s+/g, ' ').trim()

/** Дописать ключевое слово (одно за раз): прежнее уточнение заменяется, null — убрать. */
export function withKeyword(q: string, kw: string | null): string {
  let base = cleanQuery(q)
  for (const k of KEYWORDS) {
    const re = new RegExp(`(?:^|\\s)${k.q.replace(/\s+/g, '\\s+')}$`, 'i')
    if (re.test(base)) { base = base.replace(re, '').trim(); break }
  }
  return kw ? cleanQuery(`${base} ${kw}`) : base
}

export function activeKeyword(q: string): string | null {
  const s = cleanQuery(q).toLowerCase()
  return KEYWORDS.find((k) => s === k.q || s.endsWith(' ' + k.q))?.q ?? null
}
