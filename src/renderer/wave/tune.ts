import type { Track, WaveMode } from '../../shared/types'

/** Настройки Волны как в VK Микс: настроение, узнаваемость, язык. В каждой группе — один выбор или ничего. */
export type Mood = 'joy' | 'sad' | 'active' | 'calm' | 'love'
export type Recog = 'known' | 'unknown' | 'new'
export type Lang = 'ru' | 'foreign' | 'none'
export type WaveTune = { mood: Mood | null; recog: Recog | null; lang: Lang | null }

export const EMPTY_TUNE: WaveTune = { mood: null, recog: null, lang: null }

export const MOODS: [Mood, string][] = [['joy', 'Радостно'], ['sad', 'Грустно'], ['active', 'Активно'], ['calm', 'Спокойно'], ['love', 'Любовь']]
export const RECOGS: [Recog, string][] = [['known', 'Знакомое'], ['unknown', 'Незнакомое'], ['new', 'Новинки']]
export const LANGS: [Lang, string][] = [['ru', 'Русский'], ['foreign', 'Иностранный'], ['none', 'Без слов']]

const label = <K extends string>(xs: [K, string][], k: K | null) => xs.find(([x]) => x === k)?.[1]

/** «Грустно · Русский» — подпись под плашкой. Пусто, если ничего не выбрано. */
export function tuneSummary(t: WaveTune): string {
  return [label(MOODS, t.mood), label(RECOGS, t.recog), label(LANGS, t.lang)].filter(Boolean).join(' · ')
}

export function isEmptyTune(t: WaveTune): boolean { return !t.mood && !t.recog && !t.lang }

export function normalizeTune(x: unknown): WaveTune {
  const o = (x ?? {}) as Partial<WaveTune>
  const pick = <K extends string>(v: unknown, xs: [K, string][]) => (xs.some(([k]) => k === v) ? (v as K) : null)
  return { mood: pick(o.mood, MOODS), recog: pick(o.recog, RECOGS), lang: pick(o.lang, LANGS) }
}

/** Узнаваемость → режим отбора: знакомое — из твоей музыки, незнакомое и новинки — только новое. */
export function modeFor(t: WaveTune): WaveMode {
  return t.recog === 'known' ? 'fav' : t.recog ? 'new' : 'mix'
}

const CYR = /[а-яё]/i
const NO_WORDS = /instrumental|инструментал|\binst\b|\(inst|минус|karaoke|lo-?fi|ambient|piano|фортепиано|ost\b|soundtrack|саундтрек|beat\b|бит\b|type beat|classical|orchestra/i

export function matchLang(t: Track, l: Lang): boolean {
  const s = `${t.title} ${t.artist}`
  if (l === 'none') return NO_WORDS.test(s)
  if (l === 'ru') return CYR.test(s) && !NO_WORDS.test(s)
  return !CYR.test(s) && !NO_WORDS.test(s)
}

const MOOD_RX: Record<Mood, RegExp> = {
  joy: /happy|summer|party|dance|fun|sun|smile|лет[оа]|танц|весел|весёл|радост|солн|улыб|праздн/i,
  sad: /sad|tears|cry|lonely|alone|broken|pain|грус|слез|слёз|плач|одино|боль|тоск|печал|разбит/i,
  active: /phonk|drill|club|bass|energy|workout|hard|rave|speed ?up|sped up|фонк|драйв|качал|трен/i,
  calm: /chill|lo-?fi|acoustic|piano|ambient|sleep|calm|slowed|relax|спокой|тих|сон|акустик|медлен/i,
  love: /love|heart|kiss|baby|darling|люб|сердц|поцел|нежн|роман|влюб/i
}

export function matchMood(t: Track, m: Mood): boolean { return MOOD_RX[m].test(`${t.title} ${t.artist}`) }

const MOOD_Q: Record<Mood, [string, string]> = {
  joy: ['весёлые песни', 'happy songs'],
  sad: ['грустные песни', 'sad songs'],
  active: ['энергичная музыка', 'workout music'],
  calm: ['спокойная музыка', 'chill music'],
  love: ['песни про любовь', 'love songs']
}

/** Дополнительные поиски ВК под настройки, чтобы было из чего выбирать. */
export function tuneQueries(t: WaveTune, topArtists: string[]): { q: string; byDate: boolean }[] {
  const byDate = t.recog === 'new'
  const out: { q: string; byDate: boolean }[] = []
  if (t.mood) {
    const [ru, en] = MOOD_Q[t.mood]
    if (t.lang === 'none') out.push({ q: `${en} instrumental`, byDate })
    else {
      if (t.lang !== 'foreign') out.push({ q: ru, byDate })
      if (t.lang !== 'ru') out.push({ q: en, byDate })
    }
  } else if (t.lang === 'none') out.push({ q: 'instrumental', byDate }, { q: 'lofi beats', byDate })
  else if (t.lang === 'ru') out.push({ q: 'русские хиты', byDate })
  else if (t.lang === 'foreign') out.push({ q: 'top hits', byDate })
  if (byDate) for (const a of topArtists.slice(0, 4)) out.push({ q: a, byDate: true })
  return out
}

const DAY = 86_400_000

/**
 * Отбирает кандидатов под настройки. Язык — жёсткий фильтр (если подходящих совсем мало, берём что есть),
 * настроение и «Новинки» — только подходящие, если их хватает на пачку, иначе все.
 * extra — id треков из поисков под настроение: они считаются подходящими по настроению.
 */
export function applyTune(cands: Track[], t: WaveTune, extra: Set<string>, now: number, size: number): Track[] {
  let xs = cands
  if (t.lang) {
    const l = t.lang
    const ok = xs.filter((x) => matchLang(x, l))
    xs = ok.length >= Math.min(8, size) ? ok : [...ok, ...xs.filter((x) => !matchLang(x, l))]
  }
  const prefer = (fit: (x: Track) => boolean) => {
    const yes = xs.filter(fit)
    xs = yes.length >= size ? yes : xs
  }
  if (t.recog === 'new') prefer((x) => !!x.addedAt && now - x.addedAt * 1000 < 180 * DAY)
  if (t.mood) { const m = t.mood; prefer((x) => extra.has(x.id) || matchMood(x, m)) }
  return xs
}
