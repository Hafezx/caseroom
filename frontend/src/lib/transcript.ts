export type TranscriptRole = 'user' | 'agent'

export interface TranscriptTurn {
  role: TranscriptRole
  text: string
  id?: string
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
