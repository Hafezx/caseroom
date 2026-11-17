# Agent validation

On 17 November 2026, I published the private **CaseRoom — Maya Patel** ElevenLabs Agent and tested it in the ElevenLabs text preview. The test used only the fictional facts in [`agent/scenario.md`](../agent/scenario.md).

| Candidate message | Observed behavior |
| --- | --- |
| “Before we talk about the delays, what is worrying you most right now?” | Maya identified her housing concern, the six-week tenancy deadline, and the uncertainty about a short extension. |
| “What have you been told is causing the delay, and what would you like to understand by the end of this meeting?” | Maya named outstanding leasehold enquiries and the unwritten bathroom repair promise, then asked about next steps and updates. |

These checks validate the fictional client's behavior in dashboard chat.

## Browser voice check

The local FastAPI service requested a signed URL for this private agent and received a successful response from ElevenLabs. The restricted key needed ElevenAgents Write permission for that endpoint.

I then opened CaseRoom in Chrome, allowed microphone access for that visit, and started a real voice session. The app reached its live state, received Maya's opening message and a later response as transcript events, and showed the transcript and five reflection prompts after **End interview**. The browser session used the original fictional scenario and no real client details.

The first run also exposed a silence-only `...` transcript turn and bracketed emotion cues in an agent reply. I updated the prompt to request only spoken words and added transcript cleanup for these cases. A subsequent ElevenLabs text-preview reply contained no bracketed cues. The frontend cleanup has automated tests, but I have not run a second browser voice session after those changes.

The agent is private and requires signed URLs. Its configured maximum conversation duration is five minutes, its daily call limit is 20, call-audio storage is off, its retention period is one day, and transcript/PII deletion is enabled. These settings apply to the demo agent in my account; anyone running the repository should review their own agent settings.
