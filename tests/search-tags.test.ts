import { describe, it, expect } from 'vitest'
import { withKeyword, cleanQuery, TAGS, KEYWORDS } from '../src/renderer/ui/searchTags'

describe('search tags', () => {
  it('appends a keyword once', () => {
    expect(withKeyword('Дворы', 'slowed')).toBe('Дворы slowed')
    expect(withKeyword('Дворы slowed', 'slowed')).toBe('Дворы slowed')
    expect(withKeyword('', 'remix')).toBe('remix')
  })
  it('switching keyword replaces the previous one', () => {
    expect(withKeyword('Дворы slowed', 'speed up')).toBe('Дворы speed up')
    expect(withKeyword('Дворы speed up', null)).toBe('Дворы')
  })
  it('cleanQuery strips # and extra spaces', () => {
    expect(cleanQuery('  #фонк   ночь ')).toBe('фонк ночь')
  })
  it('has tags and keywords', () => { expect(TAGS.length).toBeGreaterThan(8); expect(KEYWORDS.map((k) => k.q)).toContain('slowed') })
})
