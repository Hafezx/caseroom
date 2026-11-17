import { describe, expect, it } from 'vitest'
import { addTranscriptMessage, type TranscriptTurn } from './transcript'

describe('addTranscriptMessage', () => {
  it('keeps separate spoken turns and ignores empty text', () => {
    const first = addTranscriptMessage([], { role: 'agent', text: '  Hello there.  ' })
    const second = addTranscriptMessage(first, { role: 'user', text: 'What has happened?' })
    const empty = addTranscriptMessage(second, { role: 'agent', text: '   ' })

    expect(empty).toEqual([
      { role: 'agent', text: 'Hello there.' },
      { role: 'user', text: 'What has happened?' },
    ])
  })

  it('replaces an interim turn with its final text when they share an id', () => {
    const interim: TranscriptTurn[] = [{ role: 'user', text: 'When is', id: 'turn-1' }]
    expect(addTranscriptMessage(interim, { role: 'user', text: 'When is completion?', id: 'turn-1' })).toEqual([
      { role: 'user', text: 'When is completion?', id: 'turn-1' },
    ])
  })

  it('does not duplicate a repeated callback', () => {
    const first = addTranscriptMessage([], { role: 'agent', text: 'I am worried about the move.' })
    expect(addTranscriptMessage(first, { role: 'agent', text: 'I am worried about the move.' })).toEqual(first)
  })
})
