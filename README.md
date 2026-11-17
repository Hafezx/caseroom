# CaseRoom

[![CI](https://github.com/Hafezx/caseroom/actions/workflows/ci.yml/badge.svg)](https://github.com/Hafezx/caseroom/actions/workflows/ci.yml)

CaseRoom is a standalone voice practice demo for an SQE2-style client interview. An ElevenLabs Agent plays a fictional client, while a Vue app shows the conversation and helps the candidate reflect on their interviewing skills. A Python API keeps ElevenLabs credentials on the server and creates short-lived voice sessions.

The first scenario is an original Property Practice case about a delayed flat purchase. CaseRoom is an independent practice tool and is not affiliated with the Solicitors Regulation Authority. It does not provide legal advice, official scoring, or pass predictions.

## What you can do

- Read a short partner briefing and interview Maya Patel by voice.
- Follow the live transcript and end the session whenever you are ready.
- Review your words against five [SRA client-interview skill areas](https://sqe.sra.org.uk/assessments/sqe2-assessments/sqe2-specification/sqe2-assessments), then try again. The reflection prompts do not grade the interview.

## Run locally

You need Python 3.11+, Node.js, [uv](https://docs.astral.sh/uv/), an ElevenLabs account, and an ElevenLabs Agent configured as **private**. Agent voice usage may consume plan credits; see [ElevenLabs Agents pricing](https://elevenlabs.io/pricing/agents).

1. Create an ElevenLabs Agent. Use the original [client prompt](agent/client-prompt.md), including its separate first message. Enable authentication so sessions require a [signed URL](https://elevenlabs.io/docs/eleven-agents/customization/authentication). Enable transcript message events in the agent's Advanced settings if they are off. For privacy, review the agent's [retention](https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention) and [audio-saving](https://elevenlabs.io/docs/eleven-agents/customization/privacy/audio-saving) settings.
2. Copy `backend/.env.example` to `backend/.env`. Put your API key and private agent ID in `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID`. The signed-URL endpoint currently requires **ElevenAgents Write** permission on the key. Limit its lifetime and credits, and never commit `.env`.
3. In one terminal, run the backend:

   ```bash
   cd backend
   uv sync --extra dev
   uv run --extra dev uvicorn app.main:app --reload --port 8000
   ```

4. In another terminal, run the frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. Open the local address shown by Vite. Select **Start interview** and allow microphone access. The Vite development server proxies `/api` to the backend on port 8000.

The app needs a real ElevenLabs session to answer the application question “Have you used ElevenLabs?” accurately. Code or a visual preview alone does not establish that.

## Checks

```bash
cd backend && uv run --extra dev pytest -q
cd frontend && npm test && npm run typecheck && npm run build
```

The agent's manual behavior checks are in [scenario.md](agent/scenario.md), and the [validation log](docs/agent-validation.md) records the two checks completed in ElevenLabs Preview. The [architecture note](docs/architecture.md) explains the request flow and privacy boundaries.

## Design choices

- **Python + FastAPI:** the server requests short-lived signed URLs and handles provider failures without exposing its API key.
- **Vue + ElevenLabs JS client:** the browser handles microphone, voice state, and transcript events.
- **No local transcript storage:** the interview text stays in browser memory. ElevenLabs' own retention settings still apply.
- **Formative reflection:** the [current SRA SQE2 specification](https://sqe.sra.org.uk/assessments/sqe2-assessments/sqe2-specification) assesses the client interview on skills; CaseRoom avoids pretending to reproduce an official assessor's judgment.

This is a focused demo. A public service would also need user authentication, shared rate limiting, monitoring, and a documented data-retention policy.
