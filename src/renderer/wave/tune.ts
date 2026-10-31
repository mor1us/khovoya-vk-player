import type { Track, WaveMode } from '../../shared/types'

/**
 * Настройки Волны: настроение, узнаваемость, язык. В каждой группе можно выбрать несколько.
 * Язык: «Русский» и «Иностранный» — любой из выбранных; «Без слов» — дополнительно: только инструменталы
 * (вместе с «Русским» — инструменталы русских исполнителей).
 */
export type Mood = 'joy' | 'sad' | 'active' | 'calm' | 'love'
export type Recog = 'known' | 'unknown' | 'new'
export type Lang = 'ru' | 'foreign' | 'none'
export type WaveTune = { mood: Mood[]; recog: Recog[]; lang: Lang[] }

export const EMPTY_TUNE: WaveTune = { mood: [], recog: [], lang: [] }

export const MOODS: [Mood, string][] = [['joy', 'Радостно'], ['sad', 'Грустно'], ['active', 'Активно'], ['calm', 'Спокойно'], ['love', 'Любовь']]
export const RECOGS: [Recog, string][] = [['known', 'Знакомое'], ['unknown', 'Незнакомое'], ['new', 'Новинки']]
export const RECOG_HINT = '«Новинки» сочетаются: «Незнакомое» + «Новинки» — свежее, чего нет в твоей музыке'
export const LANGS: [Lang, string][] = [['ru', 'Русский'], ['foreign', 'Иностранный'], ['none', 'Без слов']]

const labels = <K extends string>(xs: [K, string][], ks: K[]) => xs.filter(([k]) => ks.includes(k)).map(([, l]) => l)

/** «Грустно · Русский · Без слов» — подпись под Волной. Пусто, если ничего не выбрано. */
export function tuneSummary(t: WaveTune): string {
  return [...labels(MOODS, t.mood), ...labels(RECOGS, t.recog), ...labels(LANGS, t.lang)].join(' · ')
}

export function isEmptyTune(t: WaveTune): boolean { return !t.mood.length && !t.recog.length && !t.lang.length }

/** Читаем сохранённое; старый формат (одно значение в группе) тоже понимаем. */
export function normalizeTune(x: unknown): WaveTune {
  const o = (x ?? {}) as Record<string, unknown>
  const pick = <K extends string>(v: unknown, xs: [K, string][]): K[] => {
    const arr = Array.isArray(v) ? v : v == null ? [] : [v]
    return xs.map(([k]) => k).filter((k) => arr.includes(k))
  }
  return { mood: pick(o.mood, MOODS), recog: pick(o.recog, RECOGS), lang: pick(o.lang, LANGS) }
}

/**
 * Узнаваемость → режим отбора. «Знакомое» и «Незнакомое» выбирают, откуда брать (из твоей музыки или нет),
 * а «Новинки» сочетаются с ними: «Незнакомое» + «Новинки» — свежее, чего нет в твоей музыке.
 */
export function modeFor(t: WaveTune): WaveMode {
  const known = t.recog.includes('known'), unknown = t.recog.includes('unknown')
  if (known && !unknown) return 'fav'
  if (unknown && !known) return 'new'
  return 'mix'
}

const CYR = /[а-яё]/i
const NO_WORDS = /instrumental|инструментал|\binst\b|\(inst|минус|karaoke|караоке|lo-?fi|ambient|эмбиент|piano|фортепиано|\bost\b|soundtrack|саундтрек|\bbeats?\b|\bбит\b|type beat|classical|orchestra|оркестр/i

export const isInstrumental = (t: Track) => NO_WORDS.test(`${t.title} ${t.artist}`)

/**
 * Русский ли исполнитель. Буквы в имени не всегда помогают (Kai Angel, OG Buda пишутся латиницей),
 * поэтому смотрим на все известные треки артиста: если хотя бы у трети название по-русски — исполнитель русский.
 */
export function artistLangMap(tracks: Track[]): Map<string, boolean> {
  const stat = new Map<string, { ru: number; all: number }>()
  for (const t of tracks) {
    for (const name of (t.artists?.length ? t.artists.map((a) => a.name) : [t.artist])) {
      const k = name.trim().toLowerCase()
      const s = stat.get(k) ?? { ru: 0, all: 0 }
      s.all++
      if (CYR.test(t.title) || CYR.test(name)) s.ru++
      stat.set(k, s)
    }
  }
  const out = new Map<string, boolean>()
  for (const [k, s] of stat) out.set(k, s.ru / s.all >= 0.34)
  return out
}

export function isRussian(t: Track, artists?: Map<string, boolean>): boolean {
  if (CYR.test(t.title) || CYR.test(t.artist)) return true
  const names = t.artists?.length ? t.artists.map((a) => a.name) : [t.artist]
  return names.some((n) => artists?.get(n.trim().toLowerCase()) === true)
}

/** Подходит ли трек под выбранные языки (см. описание сверху). */
export function matchLangs(t: Track, langs: Lang[], artists?: Map<string, boolean>): boolean {
  if (!langs.length) return true
  const instr = isInstrumental(t)
  const wantInstr = langs.includes('none')
  const words = langs.filter((l) => l !== 'none')
  if (wantInstr && !instr) return false
  if (!wantInstr && instr) return false // просили со словами
  if (!words.length) return true
  const ru = isRussian(t, artists)
  return words.some((w) => (w === 'ru' ? ru : !ru))
}

const MOOD_RX: Record<Mood, RegExp> = {
  joy: /happy|summer|party|dance|fun|sun|smile|лет[оа]|танц|весел|весёл|радост|солн|улыб|праздн/i,
  sad: /sad|tears|cry|lonely|alone|broken|pain|грус|слез|слёз|плач|одино|боль|тоск|печал|разбит/i,
  active: /phonk|drill|club|bass|energy|workout|hard|rave|speed ?up|sped up|фонк|драйв|качал|трен/i,
  calm: /chill|lo-?fi|acoustic|piano|ambient|sleep|calm|slowed|relax|спокой|тих|сон|акустик|медлен/i,
  love: /love|heart|kiss|baby|darling|люб|сердц|поцел|нежн|роман|влюб/i
}

export function matchMood(t: Track, m: Mood): boolean { return MOOD_RX[m].test(`${t.title} ${t.artist}`) }

const MOOD_Q: Record<Mood, { ru: string; en: string; instr: string }> = {
  joy: { ru: 'весёлые песни', en: 'happy songs', instr: 'upbeat instrumental' },
  sad: { ru: 'грустные песни', en: 'sad songs', instr: 'sad piano instrumental' },
  active: { ru: 'энергичная музыка', en: 'workout music', instr: 'phonk instrumental' },
  calm: { ru: 'спокойная музыка', en: 'chill music', instr: 'lofi chill beats' },
  love: { ru: 'песни про любовь', en: 'love songs', instr: 'romantic instrumental' }
}

/**
 * Дополнительные поиски ВК под настройки. Общих запросов вроде «русские хиты» больше нет — они приносили старьё.
 * Свежее берём у твоих любимых артистов (сортировка «сначала новые») и по настроению.
 */
export function tuneQueries(t: WaveTune, topArtists: string[]): { q: string; byDate: boolean }[] {
  const fresh = t.recog.includes('new') || t.recog.includes('unknown') || !t.recog.includes('known')
  const out: { q: string; byDate: boolean }[] = []
  const instr = t.lang.includes('none')
  const words = t.lang.filter((l) => l !== 'none')
  for (const m of t.mood) {
    const q = MOOD_Q[m]
    if (instr) out.push({ q: q.instr, byDate: fresh })
    if (!instr || words.length) {
      if (!words.length || words.includes('ru')) out.push({ q: instr ? `${q.ru} без слов` : q.ru, byDate: fresh })
      if (!words.length || words.includes('foreign')) out.push({ q: instr ? q.instr : q.en, byDate: fresh })
    }
  }
  if (!t.mood.length && instr) out.push({ q: words.includes('ru') ? 'русский бит инструментал' : 'instrumental', byDate: true })
  // свежие треки любимых артистов — главный источник новинок
  if (t.recog.includes('new') || t.lang.length) for (const a of topArtists.slice(0, 5)) out.push({ q: a, byDate: true })
  const seen = new Set<string>()
  return out.filter((x) => !seen.has(x.q) && !!seen.add(x.q))
}

const DAY = 86_400_000

/** Насколько свежий трек (по дате загрузки в ВК/SoundCloud): новое — выше, очень старое — ниже. */
export function freshness(t: Track, now: number): number {
  if (!t.addedAt) return 0
  const age = now - t.addedAt * 1000
  if (age < 90 * DAY) return 3
  if (age < 365 * DAY) return 2
  if (age < 3 * 365 * DAY) return 1
  if (age > 7 * 365 * DAY) return -1
  return 0
}

/**
 * Отбор кандидатов под настройки. Язык — строгий фильтр (если подходящих совсем мало, берём что есть).
 * Настроение и «Новинки» дают кандидатам очки (см. tuneBoost), а не отсекают.
 */
export function applyTune(cands: Track[], t: WaveTune, _extra: Set<string>, now: number, size: number, artists?: Map<string, boolean>): Track[] {
  let xs = cands
  if (t.lang.length) {
    const ok = xs.filter((x) => matchLangs(x, t.lang, artists))
    xs = ok.length >= Math.min(8, size) ? ok : [...ok, ...xs.filter((x) => !matchLangs(x, t.lang, artists))]
  }
  if (t.recog.includes('new')) { // «Новинки»: только за последний год, если таких хватает на пачку
    const fresh = xs.filter((x) => freshness(x, now) >= 2)
    if (fresh.length >= size) xs = fresh
  }
  return xs
}

/**
 * Очки кандидата для ранжирования: откуда пришёл (персональные подборки ВК ценнее поиска),
 * свежесть, совпадение с настроением. Добавляются к весу артиста.
 */
export function tuneBoost(x: Track, t: WaveTune, opts: { now: number; moodHits: Set<string>; source: Map<string, number> }): number {
  let s = opts.source.get(x.id) ?? 0
  const wantsFresh = !t.recog.includes('known') || t.recog.includes('new')
  if (wantsFresh) s += freshness(x, opts.now) * (t.recog.includes('new') ? 2 : 1)
  if (t.mood.length && (opts.moodHits.has(x.id) || t.mood.some((m) => matchMood(x, m)))) s += 3
  return s
}
