const pad = (n: number) => String(n).padStart(2, '0')

export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00'
  const s = Math.floor(sec), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`
}

export function fmtTotal(sec: number): string {
  const m = Math.round(sec / 60), h = Math.floor(m / 60)
  return h ? `${h} ч ${m % 60} мин` : `${m} мин`
}

export function plural(n: number, one: string, few: string, many: string): string {
  const a = Math.abs(n) % 100, b = a % 10
  if (a > 10 && a < 20) return many
  if (b === 1) return one
  if (b >= 2 && b <= 4) return few
  return many
}

export function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}

/** Настоящая волна SoundCloud часто приходит «забором»: всё сжато в верхнюю треть и рисунка не видно.
 *  Растягиваем от самого тихого места к самому громкому, сохраняя форму. */
export function stretchBars(bars: number[]): number[] {
  if (bars.length < 2) return bars
  let lo = Infinity, hi = -Infinity
  for (const b of bars) { if (b < lo) lo = b; if (b > hi) hi = b }
  if (!(hi > lo)) return bars
  return bars.map((b) => 0.12 + ((b - lo) / (hi - lo)) * 0.88)
}

/** Форма «звуковой волны» для полосы перемотки — своя у каждого трека, но всегда одинаковая. */
export function waveBars(id: string, n: number): number[] {
  let s = hashStr(id) || 1
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32 }
  const ph = r() * 6
  return Array.from({ length: n }, (_, i) => {
    const v = 0.5 + Math.sin(i / 5 + ph) * 0.22 + (r() - 0.5) * 0.5
    return Math.min(1, Math.max(0.15, v))
  })
}
