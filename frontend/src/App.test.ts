// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import App from './App.vue'

const sdkState = vi.hoisted(() => ({
  startError: null as Error | null,
  triggerError: null as null | (() => void),
  triggerCorrection: null as null | (() => void),
  endCount: 0,
  delayDisconnect: false,
  pendingDisconnect: null as null | (() => void),
  deferFirstStart: false,
  startCount: 0,
  rejectFirstStart: null as null | ((error: Error) => void),
}))

vi.mock('@elevenlabs/client', () => ({
  Conversation: {
    startSession: async (options: {
      onConnect?: (value: { conversationId: string }) => void
      onMessage?: (value: { role: 'agent'; source: 'ai'; message: string; event_id: number }) => void
      onDisconnect?: (value: { reason: 'user' }) => void
      onError?: (message: string) => void
      onAgentResponseCorrection?: (value: {
        original_agent_response: string
        corrected_agent_response: string
        event_id: number
        response_id?: string
      }) => void
    }) => {
      sdkState.startCount += 1
      if (sdkState.deferFirstStart && sdkState.startCount === 1) {
        sdkState.triggerError = () => options.onError?.('Connection lost')
        return await new Promise<never>((_resolve, reject) => { sdkState.rejectFirstStart = reject })
      }
      if (sdkState.startError) throw sdkState.startError
      sdkState.triggerError = () => options.onError?.('Connection lost')
      sdkState.triggerCorrection = () => options.onAgentResponseCorrection?.({
        original_agent_response: 'Hello, thanks for meeting me.',
        corrected_agent_response: 'Hello, thanks for seeing me.',
        event_id: 2,
      })
      options.onConnect?.({ conversationId: 'conv-test' })
      options.onMessage?.({ role: 'agent', source: 'ai', message: 'Hello, thanks for meeting me.', event_id: 1 })
      return { endSession: async () => {
        sdkState.endCount += 1
        if (sdkState.delayDisconnect) sdkState.pendingDisconnect = () => options.onDisconnect?.({ reason: 'user' })
        else options.onDisconnect?.({ reason: 'user' })
      } }
    },
  },
}))

describe('CaseRoom practice flow', () => {
  beforeEach(() => {
    sdkState.startError = null
    sdkState.triggerError = null
    sdkState.triggerCorrection = null
    sdkState.endCount = 0
    sdkState.delayDisconnect = false
    sdkState.pendingDisconnect = null
    sdkState.deferFirstStart = false
    sdkState.startCount = 0
    sdkState.rejectFirstStart = null
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => undefined }] }) },
    })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ signed_url: 'wss://api.elevenlabs.io/test' }),
    })))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('moves from the briefing to a live interview, reflection, and another attempt', async () => {
    const wrapper = mount(App)
    expect(wrapper.text()).toContain('Client interview practice')

    await wrapper.get('button[data-action="start"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Interview in progress')
    expect(wrapper.text()).toContain('Hello, thanks for meeting me.')

    await wrapper.get('button[data-action="end"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Interview reflection')
    expect(wrapper.text()).toContain('Listening and questioning')

    await wrapper.get('button[data-action="retry"]').trigger('click')
    expect(wrapper.text()).toContain('Ready to begin')
    expect(wrapper.text()).not.toContain('Hello, thanks for meeting me.')
    wrapper.unmount()
  })

  it('shows a corrected agent response in the reflection transcript', async () => {
    const wrapper = mount(App)
    await wrapper.get('button[data-action="start"]').trigger('click')
    await flushPromises()
    sdkState.triggerCorrection?.()
    await wrapper.get('button[data-action="end"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Hello, thanks for seeing me.')
    expect(wrapper.text()).not.toContain('Hello, thanks for meeting me.')
    wrapper.unmount()
  })

  it('shows a retryable message when the session endpoint is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })))
    const wrapper = mount(App)

    await wrapper.get('button[data-action="start"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Voice sessions are unavailable')
    expect(wrapper.find('button[data-action="retry"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('explains a blocked microphone and keeps the controls usable', async () => {
    sdkState.startError = new DOMException('Permission denied', 'NotAllowedError')
    const wrapper = mount(App)

    await wrapper.get('button[data-action="start"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Microphone access was blocked')
    await wrapper.get('button[data-action="retry"]').trigger('click')
    expect(wrapper.text()).toContain('Ready to begin')
    wrapper.unmount()
  })

  it('does not request a paid voice session when microphone permission is denied', async () => {
    vi.stubGlobal('navigator', {
      mediaDevices: { getUserMedia: async () => { throw new DOMException('Permission denied', 'NotAllowedError') } },
    })
    const requestSession = vi.fn()
    vi.stubGlobal('fetch', requestSession)
    const wrapper = mount(App)

    await wrapper.get('button[data-action="start"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Microphone access was blocked')
    expect(requestSession).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('explains the practice flow from the header', async () => {
    const wrapper = mount(App)
    await wrapper.get('button[data-action="how-it-works"]').trigger('click')
    expect(wrapper.text()).toContain('Speak with Maya')
    wrapper.unmount()
  })

  it('closes an active voice session if the SDK reports an error', async () => {
    const wrapper = mount(App)
    await wrapper.get('button[data-action="start"]').trigger('click')
    await flushPromises()
    sdkState.triggerError?.()
    await flushPromises()
    expect(wrapper.text()).toContain('The voice connection was interrupted')
    expect(sdkState.endCount).toBe(1)
    wrapper.unmount()
  })

  it('ignores a late disconnect from an earlier session after retry', async () => {
    sdkState.delayDisconnect = true
    const wrapper = mount(App)
    await wrapper.get('button[data-action="start"]').trigger('click')
    await flushPromises()
    sdkState.triggerError?.()
    await flushPromises()
    await wrapper.get('button[data-action="retry"]').trigger('click')
    await wrapper.get('button[data-action="start"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Interview in progress')

    sdkState.pendingDisconnect?.()
    await flushPromises()
    expect(wrapper.text()).toContain('Interview in progress')
    wrapper.unmount()
  })

  it('ignores a late startup rejection after a newer session has connected', async () => {
    sdkState.deferFirstStart = true
    const wrapper = mount(App)
    await wrapper.get('button[data-action="start"]').trigger('click')
    await flushPromises()
    sdkState.triggerError?.()
    await flushPromises()
    await wrapper.get('button[data-action="retry"]').trigger('click')
    await wrapper.get('button[data-action="start"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Interview in progress')

    sdkState.rejectFirstStart?.(new Error('old connection failed'))
    await flushPromises()
    expect(wrapper.text()).toContain('Interview in progress')
    wrapper.unmount()
  })
})
