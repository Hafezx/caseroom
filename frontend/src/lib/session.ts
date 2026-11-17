export type InterviewPhase = 'ready' | 'connecting' | 'live' | 'reflection' | 'error'
export type InterviewEvent = 'START' | 'CONNECTED' | 'END' | 'DISCONNECTED' | 'FAIL' | 'RETRY'

export function nextPhase(phase: InterviewPhase, event: InterviewEvent): InterviewPhase {
  if (event === 'RETRY' && (phase === 'reflection' || phase === 'error')) return 'ready'
  if (event === 'START' && phase === 'ready') return 'connecting'
  if (event === 'CONNECTED' && phase === 'connecting') return 'live'
  if (event === 'END' && phase === 'live') return 'reflection'
  if (event === 'DISCONNECTED' && phase === 'live') return 'reflection'
  if ((event === 'FAIL' || event === 'DISCONNECTED') && phase === 'connecting') return 'error'
  return phase
}
