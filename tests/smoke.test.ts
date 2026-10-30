import { describe, it, expect } from 'vitest'
import { APP_NAME } from '../src/shared/app'
describe('smoke', () => {
  it('app name is Хвоя', () => { expect(APP_NAME).toBe('Хвоя') })
})
