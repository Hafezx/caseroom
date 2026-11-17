<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { MessagePayload, VoiceConversation } from '@elevenlabs/client'
import BriefingPanel from './components/BriefingPanel.vue'
import Waveform from './components/Waveform.vue'
import SkillsReflection from './components/SkillsReflection.vue'
import { nextPhase, type InterviewPhase } from './lib/session'
import { addTranscriptMessage, applyAgentResponseCorrection, type TranscriptTurn } from './lib/transcript'

const phase = ref<InterviewPhase>('ready')
const transcript = ref<TranscriptTurn[]>([])
const elapsedSeconds = ref(0)
const mode = ref<'listening' | 'speaking'>('listening')
const showHowItWorks = ref(false)
const copyStatus = ref('')
const errorMessage = ref('')
let conversation: VoiceConversation | null = null
let timer: ReturnType<typeof setInterval> | null = null
let sessionGeneration = 0

const timeLabel = computed(() => {
  const minutes = Math.floor(elapsedSeconds.value / 60).toString().padStart(2, '0')
  const seconds = (elapsedSeconds.value % 60).toString().padStart(2, '0')
  return `${minutes}:${seconds}`
})
const statusTitle = computed(() => {
  if (phase.value === 'connecting') return 'Connecting to Maya'
  if (phase.value === 'live') return 'Interview in progress'
  if (phase.value === 'error') return errorMessage.value
  return 'Ready to begin'
})

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}
function startTimer() {
  stopTimer()
  timer = setInterval(() => { elapsedSeconds.value += 1 }, 1000)
}
function handleMessage(message: MessagePayload, generation: number) {
  if (generation !== sessionGeneration) return
  transcript.value = addTranscriptMessage(transcript.value, {
    role: message.role,
    text: message.message,
    id: message.response_id ?? String(message.event_id),
  })
}
function handleDisconnect(generation: number) {
  if (generation !== sessionGeneration) return
  stopTimer()
  if (phase.value === 'live') phase.value = nextPhase(phase.value, 'DISCONNECTED')
  else if (phase.value === 'connecting') {
    errorMessage.value = 'The interview disconnected before it started'
    phase.value = nextPhase(phase.value, 'DISCONNECTED')
  }
  conversation = null
}

async function startInterview() {
  if (phase.value !== 'ready') return
  const generation = ++sessionGeneration
  phase.value = nextPhase(phase.value, 'START')
  transcript.value = []
  elapsedSeconds.value = 0
  errorMessage.value = ''
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone unavailable')
    const microphone = await navigator.mediaDevices.getUserMedia({ audio: true })
    microphone.getTracks().forEach((track) => track.stop())
    if (generation !== sessionGeneration) return
    const response = await fetch('/api/practice-session', { method: 'POST' })
    if (!response.ok) {
      errorMessage.value = response.status === 503
        ? 'Voice sessions are unavailable'
        : response.status === 429
          ? 'Session limit reached. Please try again later'
          : 'The interview could not start'
      phase.value = nextPhase(phase.value, 'FAIL')
      return
    }
    const payload: unknown = await response.json()
    const signedUrl = typeof payload === 'object' && payload !== null && 'signed_url' in payload
      ? payload.signed_url : null
    if (typeof signedUrl !== 'string' || !signedUrl.startsWith('wss://')) throw new Error('Invalid session response')

    const { Conversation } = await import('@elevenlabs/client')
    const started = await Conversation.startSession({
      signedUrl,
      connectionType: 'websocket',
      textOnly: false,
      onConnect: () => {
        if (generation !== sessionGeneration) return
        if (phase.value === 'connecting') {
          phase.value = nextPhase(phase.value, 'CONNECTED')
          startTimer()
        }
      },
      onMessage: (message) => handleMessage(message, generation),
      onAgentResponseCorrection: (correction) => {
        if (generation !== sessionGeneration) return
        transcript.value = applyAgentResponseCorrection(transcript.value, {
          responseId: correction.response_id,
          originalText: correction.original_agent_response,
          correctedText: correction.corrected_agent_response,
        })
      },
      onModeChange: ({ mode: nextMode }) => { if (generation === sessionGeneration) mode.value = nextMode },
      onDisconnect: () => handleDisconnect(generation),
      onError: () => {
        if (generation !== sessionGeneration) return
        if (phase.value === 'connecting' || phase.value === 'live') {
          stopTimer()
          errorMessage.value = 'The voice connection was interrupted'
          phase.value = 'error'
          const activeConversation = conversation
          conversation = null
          void activeConversation?.endSession().catch(() => undefined)
        }
      },
    })
    if (generation !== sessionGeneration || phase.value === 'error') {
      await started.endSession().catch(() => undefined)
      return
    }
    conversation = started
    if (phase.value === 'connecting') {
      phase.value = nextPhase(phase.value, 'CONNECTED')
      startTimer()
    }
  } catch (error) {
    if (generation !== sessionGeneration) return
    stopTimer()
    const details = typeof error === 'object' && error !== null ? error as { name?: unknown; message?: unknown } : {}
    const denied = details.name === 'NotAllowedError' || (typeof details.message === 'string' && /microphone|permission/i.test(details.message))
    errorMessage.value = denied ? 'Microphone access was blocked' : 'The interview could not connect'
    phase.value = 'error'
  }
}
async function endInterview() {
  if (phase.value !== 'live') return
  phase.value = nextPhase(phase.value, 'END')
  stopTimer()
  const activeConversation = conversation
  conversation = null
  try { await activeConversation?.endSession() } catch { /* Already closed. */ }
}
function retryInterview() {
  sessionGeneration += 1
  stopTimer()
  phase.value = nextPhase(phase.value, 'RETRY')
  transcript.value = []
  elapsedSeconds.value = 0
  copyStatus.value = ''
  errorMessage.value = ''
  mode.value = 'listening'
}
async function copyTranscript() {
  const text = transcript.value.map((turn) => `${turn.role === 'agent' ? 'Maya Patel' : 'You'}: ${turn.text}`).join('\n\n')
  if (!text || !navigator.clipboard?.writeText) return
  try {
    await navigator.clipboard.writeText(text)
    copyStatus.value = 'Transcript copied'
  } catch { copyStatus.value = 'Could not copy transcript' }
}
onBeforeUnmount(() => {
  sessionGeneration += 1
  stopTimer()
  void conversation?.endSession().catch(() => undefined)
})
</script>

<template>
  <div class="page">
    <header class="site-header">
      <div class="header-inner">
        <a class="wordmark" href="#practice" aria-label="CaseRoom home" @click="showHowItWorks = false">CaseRoom</a>
        <nav class="main-nav" aria-label="Main navigation">
          <a class="nav-link active" href="#practice" @click="showHowItWorks = false">Practice</a>
          <button type="button" class="nav-link" data-action="how-it-works" @click="showHowItWorks = true">How it works</button>
        </nav>
      </div>
    </header>

    <main id="practice" class="app-shell">
      <template v-if="phase === 'reflection'">
        <div class="reflection-intro">
          <h1>Interview reflection</h1>
          <p>Review your conversation and decide what to practise next.</p>
        </div>
        <div class="reflection-grid">
          <section class="surface transcript-panel" aria-labelledby="transcript-heading">
            <div class="panel-heading">
              <h2 id="transcript-heading">Transcript</h2>
              <button type="button" class="outline-button" :disabled="transcript.length === 0" @click="copyTranscript">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="1.5"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>
                Copy transcript
              </button>
            </div>
            <p v-if="copyStatus" class="copy-status" role="status">{{ copyStatus }}</p>
            <div v-if="transcript.length" class="transcript-list">
              <article v-for="(turn, index) in transcript" :key="turn.id ?? index" class="transcript-turn">
                <h3 :class="turn.role === 'agent' ? 'client-name' : ''">{{ turn.role === 'agent' ? 'Maya Patel' : 'You' }}</h3>
                <p>{{ turn.text }}</p>
              </article>
            </div>
            <p v-else class="empty-transcript">No transcript was captured. Try another interview to review your conversation.</p>
          </section>
          <div class="reflection-side">
            <SkillsReflection />
            <button type="button" class="primary-button retry-button" data-action="retry" @click="retryInterview">Try again</button>
          </div>
        </div>
      </template>

      <div v-else class="practice-grid">
        <BriefingPanel />
        <section class="surface interview-panel" aria-label="Interview room" aria-live="polite">
          <Waveform :active="phase === 'live'" :speaking="mode === 'speaking'" />
          <div class="interview-content">
            <h2>{{ statusTitle }}</h2>
            <div class="timer" aria-label="Interview time">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>
              <span>{{ timeLabel }}</span>
            </div>
            <p v-if="phase === 'live'" class="mode-label" role="status">{{ mode === 'speaking' ? 'Maya is speaking' : 'Listening to you' }}</p>
            <button v-if="phase === 'ready'" type="button" class="primary-button interview-button" data-action="start" @click="startInterview">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8"/></svg>
              Start interview
            </button>
            <button v-else-if="phase === 'connecting'" type="button" class="primary-button interview-button" disabled>Connecting…</button>
            <button v-else-if="phase === 'live'" type="button" class="primary-button interview-button" data-action="end" @click="endInterview">End interview</button>
            <button v-else type="button" class="primary-button interview-button" data-action="retry" @click="retryInterview">Try again</button>
            <p v-if="phase === 'ready'" class="helper-text">We’ll ask for microphone permission when you start.</p>
            <p v-else-if="phase === 'error'" class="helper-text">Check your connection or microphone settings, then try again.</p>
            <p v-else-if="phase === 'connecting'" class="helper-text">Opening a private voice session…</p>
            <div v-if="phase === 'live'" class="live-transcript" aria-label="Live transcript">
              <p class="live-transcript-label">Live transcript</p>
              <p v-if="transcript.length"><strong>{{ transcript.at(-1)?.role === 'agent' ? 'Maya' : 'You' }}:</strong> {{ transcript.at(-1)?.text }}</p>
              <p v-else>Your conversation will appear here as you speak.</p>
            </div>
            <p v-if="phase === 'ready'" class="privacy-note">ElevenLabs processes your voice. Use fictional details only.</p>
          </div>
        </section>
      </div>
    </main>

    <footer class="site-footer"><div>Independent practice tool. Not affiliated with the SRA.</div></footer>

    <div v-if="showHowItWorks" class="dialog-backdrop" @click.self="showHowItWorks = false">
      <div class="how-dialog" role="dialog" aria-modal="true" aria-labelledby="how-heading" @keydown.esc="showHowItWorks = false">
        <button type="button" class="close-button" aria-label="Close" @click="showHowItWorks = false">×</button>
        <h2 id="how-heading">How it works</h2>
        <ol>
          <li><strong>Read the briefing.</strong> Take a moment to understand the client’s situation.</li>
          <li><strong>Speak with Maya.</strong> Ask questions and practise a client-focused conversation.</li>
          <li><strong>Reflect on your words.</strong> Review your transcript against five interview skills.</li>
        </ol>
        <p>This is an independent practice tool, not an official assessment or legal advice.</p>
      </div>
    </div>
  </div>
</template>
