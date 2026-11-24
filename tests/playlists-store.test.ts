import { describe, it, expect, vi } from 'vitest'
import { optimistic, planAdd, moveItem } from '../src/renderer/store/playlistLogic'

describe('optimistic', () => {
  it('rolls back and returns false when commit fails', async () => {
    let state = [1, 2]
    const ok = await optimistic(() => { const prev = state; state = [...state, 3]; return prev }, async () => { throw new Error('x') }, (prev) => { state = prev })
    expect(ok).toBe(false)
    expect(state).toEqual([1, 2])
  })
  it('keeps the change and returns true on success', async () => {
    let state = [1]
    const rb = vi.fn()
    expect(await optimistic(() => { const p = state; state = [1, 2]; return p }, async () => {}, rb)).toBe(true)
    expect(state).toEqual([1, 2]); expect(rb).not.toHaveBeenCalled()
  })
})

describe('planAdd', () => {
  it('detects duplicates and does not need an API call when all exist', () => {
    expect(planAdd(['a', 'b'], ['a'])).toEqual({ toAdd: [], duplicate: true })
  })
  it('adds only new ids, flags partial duplicates', () => {
    expect(planAdd(['a'], ['a', 'b', 'b'])).toEqual({ toAdd: ['b'], duplicate: true })
    expect(planAdd([], ['x'])).toEqual({ toAdd: ['x'], duplicate: false })
  })
})

describe('moveItem', () => {
  it('moves and reports neighbours for audio.reorder', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 'd', 1)).toEqual({ list: ['a', 'd', 'b', 'c'], before: 'b', after: 'a' })
    expect(moveItem(['a', 'b', 'c'], 'a', 2)).toEqual({ list: ['b', 'c', 'a'], before: undefined, after: 'c' })
    expect(moveItem(['a', 'b'], 'zz', 0).list).toEqual(['a', 'b'])
  })
})
