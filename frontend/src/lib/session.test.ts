import { describe, expect, it } from 'vitest'
import { nextPhase } from './session'

describe('nextPhase', () => {
  it('moves through a complete interview and resets for another attempt', () => {
    expect(nextPhase('ready', 'START')).toBe('connecting')
    expect(nextPhase('connecting', 'CONNECTED')).toBe('live')
    expect(nextPhase('live', 'END')).toBe('reflection')
    expect(nextPhase('reflection', 'RETRY')).toBe('ready')
  })

  it('makes connection failures retryable and preserves a finished conversation on disconnect', () => {
    expect(nextPhase('connecting', 'FAIL')).toBe('error')
    expect(nextPhase('error', 'RETRY')).toBe('ready')
    expect(nextPhase('live', 'DISCONNECTED')).toBe('reflection')
  })
})
