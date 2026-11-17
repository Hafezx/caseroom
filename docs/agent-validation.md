# Agent validation

On 17 November 2026, I published the private **CaseRoom — Maya Patel** ElevenLabs Agent and tested it in the ElevenLabs text preview. The test used only the fictional facts in [`agent/scenario.md`](../agent/scenario.md).

| Candidate message | Observed behavior |
| --- | --- |
| “Before we talk about the delays, what is worrying you most right now?” | Maya identified her housing concern, the six-week tenancy deadline, and the uncertainty about a short extension. |
| “What have you been told is causing the delay, and what would you like to understand by the end of this meeting?” | Maya named outstanding leasehold enquiries and the unwritten bathroom repair promise, then asked about next steps and updates. |

This validates two prompt behaviors in dashboard chat. It does not establish that the browser voice flow works; that requires a separate end-to-end session through the app.

The local FastAPI service also requested a signed URL for this private agent and received a successful response from ElevenLabs. The restricted key needed ElevenAgents Write permission for that endpoint. This verifies backend authentication, but not the microphone and browser conversation path.

The agent is private and requires signed URLs. Its configured maximum conversation duration is five minutes, its daily call limit is 20, call-audio storage is off, its retention period is one day, and transcript/PII deletion is enabled. These settings apply to the demo agent in my account; anyone running the repository should review their own agent settings.
