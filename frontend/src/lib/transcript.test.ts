import { describe, expect, it } from 'vitest'
import { addTranscriptMessage, applyAgentResponseCorrection, type TranscriptTurn } from './transcript'

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

describe('applyAgentResponseCorrection', () => {
  it('updates only the agent turn with the matching response id', () => {
    const turns: TranscriptTurn[] = [
      { role: 'agent', text: 'I can move next week.', id: 'response-1' },
      { role: 'user', text: 'Are you certain?', id: 'user-2' },
      { role: 'agent', text: 'I can move next week.', id: 'response-3' },
    ]

    expect(applyAgentResponseCorrection(turns, {
      responseId: 'response-3',
      originalText: 'I can move next week.',
      correctedText: 'I may need to move next week.',
    })).toEqual([
      turns[0],
      turns[1],
      { role: 'agent', text: 'I may need to move next week.', id: 'response-3' },
    ])
  })

  it('updates the latest matching agent turn when the provider omits a response id', () => {
    const turns: TranscriptTurn[] = [
      { role: 'agent', text: 'The date was Friday.', id: '4' },
      { role: 'user', text: 'Could you repeat that?', id: '5' },
      { role: 'agent', text: 'The date was Friday.', id: '6' },
    ]

    expect(applyAgentResponseCorrection(turns, {
      originalText: 'The date was Friday.',
      correctedText: 'The date may be Friday.',
    })).toEqual([
      turns[0],
      turns[1],
      { role: 'agent', text: 'The date may be Friday.', id: '6' },
    ])
  })

  it('leaves the transcript unchanged if there is no matching agent turn', () => {
    const turns: TranscriptTurn[] = [{ role: 'user', text: 'Hello', id: '1' }]
    expect(applyAgentResponseCorrection(turns, {
      originalText: 'Hello', correctedText: 'Hi',
    })).toBe(turns)
  })
})
