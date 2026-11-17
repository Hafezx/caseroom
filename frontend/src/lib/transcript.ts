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

// ElevenLabs can include delivery and nonverbal cues in agent text. Match only
// recognized cues so ordinary bracketed speech remains in the transcript.
const nonverbalCues = new Set([
  'angry', 'annoyed', 'anxious', 'calm', 'concerned', 'curious', 'empathetic',
  'excited', 'frustrated', 'happy', 'mischievously', 'nervous', 'reassuring',
  'sad', 'sarcastic', 'surprised', 'sympathetic', 'thoughtful', 'worried',
  'chuckles', 'chuckling', 'clears throat', 'coughs', 'crying', 'gasps',
  'gasping', 'gulps', 'laughing', 'laughs', 'sighing', 'sighs', 'snorts',
  'starts crying', 'starts laughing', 'swallows', 'wheezing',
  'exhales', 'exhales sharply', 'inhales', 'inhales deeply', 'long pause',
  'pause', 'pauses', 'short pause', 'silence', 'shouting', 'shouts',
  'softly', 'whispering', 'whispers',
])

function cleanTranscriptText(text: string, removeAgentCues = true): string {
  const withoutCues = removeAgentCues
    ? text.replace(/\[([^\[\]\r\n]{1,60})\]/g, (match, label: string) => {
        const cue = label.trim().toLowerCase().replace(/\s+/g, ' ')
        return nonverbalCues.has(cue) ? ' ' : match
      })
    : text
  return withoutCues.replace(/\s+/g, ' ').trim()
}

function hasSpokenContent(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text)
}

export function addTranscriptMessage(turns: TranscriptTurn[], message: TranscriptTurn): TranscriptTurn[] {
  const text = cleanTranscriptText(message.text, message.role === 'agent')
  if (!hasSpokenContent(text)) return turns

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
  const originalText = cleanTranscriptText(correction.originalText)
  const correctedText = cleanTranscriptText(correction.correctedText)
  if (!originalText) return turns

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
  if (index < 0) return turns
  if (!hasSpokenContent(correctedText)) return turns.filter((_, position) => position !== index)
  if (turns[index].text === correctedText) return turns

  return turns.map((turn, position) => position === index ? { ...turn, text: correctedText } : turn)
}
