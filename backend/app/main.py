"""HTTP API for starting a private CaseRoom voice session."""

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse

from .elevenlabs import ElevenLabsClient, ElevenLabsServiceError
from .rate_limit import SlidingWindowRateLimiter


def create_app(
    *,
    api_key: str | None = None,
    agent_id: str | None = None,
    provider: ElevenLabsClient | None = None,
    limiter: SlidingWindowRateLimiter | None = None,
) -> FastAPI:
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
    api_key = os.getenv("ELEVENLABS_API_KEY", "") if api_key is None else api_key
    agent_id = os.getenv("ELEVENLABS_AGENT_ID", "") if agent_id is None else agent_id
    provider = provider or ElevenLabsClient(api_key=api_key)
    limiter = limiter or SlidingWindowRateLimiter(limit=3, window_seconds=900)
    app = FastAPI()

    @app.get("/api/health")
    async def health() -> dict[str, bool]:
        return {"ready": bool(api_key and agent_id)}

    @app.post("/api/practice-session")
    async def practice_session(request: Request) -> JSONResponse:
        if not api_key or not agent_id:
            raise HTTPException(
                status_code=503,
                detail="Voice practice is not configured.",
            )

        client_ip = request.client.host if request.client else "unknown"
        retry_after = limiter.take(client_ip)
        if retry_after is not None:
            raise HTTPException(
                status_code=429,
                detail="Please wait before starting another session.",
                headers={"Retry-After": str(retry_after)},
            )

        try:
            signed_url = await provider.get_signed_url(agent_id)
        except ElevenLabsServiceError as exc:
            raise HTTPException(
                status_code=502,
                detail="Could not start the voice session.",
            ) from exc

        return JSONResponse(
            {"signed_url": signed_url},
            headers={"Cache-Control": "no-store"},
        )

    return app


app = create_app()
