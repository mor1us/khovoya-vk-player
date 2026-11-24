/** Меняем интерфейс сразу, отправляем в ВК; при ошибке — откатываем. */
export async function optimistic<T>(apply: () => T, commit: () => Promise<void>, rollback: (prev: T) => void): Promise<boolean> {
  const prev = apply()
  try { await commit(); return true } catch { rollback(prev); return false }
}

export function planAdd(existing: string[], incoming: string[]): { toAdd: string[]; duplicate: boolean } {
  const have = new Set(existing)
  const toAdd: string[] = []
  let duplicate = false
  for (const id of incoming) {
    if (have.has(id)) { duplicate = true; continue }
    have.add(id); toAdd.push(id)
  }
  return { toAdd, duplicate }
}

/** Перенос элемента на позицию to; before/after — соседи для audio.reorder. */
export function moveItem(list: string[], id: string, to: number): { list: string[]; before?: string; after?: string } {
  const from = list.indexOf(id)
  if (from < 0) return { list }
  const out = list.slice()
  out.splice(from, 1)
  const at = Math.max(0, Math.min(to, out.length))
  out.splice(at, 0, id)
  return { list: out, before: out[at + 1], after: out[at - 1] }
}
