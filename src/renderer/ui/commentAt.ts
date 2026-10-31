export type C = { at: number; text: string; user: string; avatar?: string }

/** Какой комментарий показать сейчас: оставленный на этой секунде (держим 4 с). */
export function commentAt(list: C[], pos: number): C | null {
  let best: C | null = null
  for (const c of list) { if (c.at <= pos && pos - c.at < 4) best = c; if (c.at > pos) break }
  return best
}

