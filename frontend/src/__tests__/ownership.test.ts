import { describe, it, expect } from 'vitest'
import { validateOwnership } from '../ownership'

describe('ownership', () => {
  it('validateOwnership resolves without throwing', async () => {
    await expect(validateOwnership()).resolves.toBeUndefined()
  })
})
