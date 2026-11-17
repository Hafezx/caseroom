export type TranscriptRole = 'user' | 'agent'

export interface TranscriptTurn {
  role: TranscriptRole
  text: string
  id?: string
}

export interface AgentResponseCorrection {
  responseId?: string
  originalText: string
  correctedText: string
}

export function addTranscriptMessage(turns: TranscriptTurn[], message: TranscriptTurn): TranscriptTurn[] {
  const text = message.text.trim()
  if (!text) return turns

  const turn: TranscriptTurn = message.id
    ? { role: message.role, text, id: message.id }
    : { role: message.role, text }

  if (message.id) {
    const index = turns.findIndex((item) => item.id === message.id)
    if (index !== -1) {
      if (turns[index].role === turn.role && turns[index].text === text) return turns
      return turns.map((item, itemIndex) => (itemIndex === index ? turn : item))
    }
  }

  const last = turns.at(-1)
  if (last?.role === turn.role && last.text === text) return turns
  return [...turns, turn]
}

export function applyAgentResponseCorrection(
  turns: TranscriptTurn[],
  correction: AgentResponseCorrection,
): TranscriptTurn[] {
  const originalText = correction.originalText.trim()
  const correctedText = correction.correctedText.trim()
  if (!originalText || !correctedText) return turns

  const findLatest = (matches: (turn: TranscriptTurn) => boolean): number => {
    for (let position = turns.length - 1; position >= 0; position -= 1) {
      if (matches(turns[position])) return position
    }
    return -1
  }
  const matchingId = correction.responseId
    ? findLatest((turn) => turn.role === 'agent' && turn.id === correction.responseId)
    : -1
  const index = matchingId >= 0
    ? matchingId
    : findLatest((turn) => turn.role === 'agent' && turn.text === originalText)
  if (index < 0 || turns[index].text === correctedText) return turns

  return turns.map((turn, position) => position === index ? { ...turn, text: correctedText } : turn)
}
