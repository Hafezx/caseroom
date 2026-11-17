from __future__ import annotations

import httpx
import pytest

from app.elevenlabs import ElevenLabsClient
from app.main import create_app
from app.rate_limit import SlidingWindowRateLimiter


SIGNED_URL = (
    "wss://api.elevenlabs.io/v1/convai/conversation"
    "?agent_id=agent_test&conversation_signature=short-lived-token"
)


def make_test_client(handler, *, api_key="test-key", agent_id="agent_test", limiter=None):
    provider = ElevenLabsClient(api_key=api_key, transport=httpx.MockTransport(handler))
    app = create_app(
        api_key=api_key,
        agent_id=agent_id,
        provider=provider,
        limiter=limiter,
    )
    return httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://testserver")


@pytest.mark.asyncio
async def test_signed_session_uses_server_credentials_and_is_not_cached():
    observed = []

    def provider_response(request: httpx.Request) -> httpx.Response:
        observed.append(request)
        return httpx.Response(200, json={"signed_url": SIGNED_URL})

    async with make_test_client(provider_response) as client:
        assert (await client.get("/api/health")).json() == {"ready": True}
        response = await client.post("/api/practice-session")

    assert response.status_code == 200
    assert response.json() == {"signed_url": SIGNED_URL}
    assert response.headers["cache-control"] == "no-store"
    assert len(observed) == 1
    assert observed[0].url.params["agent_id"] == "agent_test"
    assert observed[0].headers["xi-api-key"] == "test-key"
    assert "test-key" not in response.text


@pytest.mark.asyncio
async def test_missing_credentials_disable_session_without_calling_provider():
    def unexpected_call(request: httpx.Request) -> httpx.Response:
        raise AssertionError("provider must not be called")

    async with make_test_client(unexpected_call, api_key="", agent_id="") as client:
        assert (await client.get("/api/health")).json() == {"ready": False}
        response = await client.post("/api/practice-session")

    assert response.status_code == 503
    assert response.json() == {"detail": "Voice practice is not configured."}


@pytest.mark.asyncio
async def test_upstream_failure_is_sanitized():
    def provider_response(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, text="private provider diagnostics")

    async with make_test_client(provider_response) as client:
        response = await client.post("/api/practice-session")

    assert response.status_code == 502
    assert response.json() == {"detail": "Could not start the voice session."}
    assert "private provider diagnostics" not in response.text


@pytest.mark.asyncio
async def test_timeout_is_sanitized():
    def provider_response(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("private timeout detail", request=request)

    async with make_test_client(provider_response) as client:
        response = await client.post("/api/practice-session")

    assert response.status_code == 502
    assert response.json() == {"detail": "Could not start the voice session."}
    assert "private timeout detail" not in response.text


@pytest.mark.asyncio
async def test_malformed_signed_url_is_rejected():
    def provider_response(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"signed_url": "https://other.example/token"})

    async with make_test_client(provider_response) as client:
        response = await client.post("/api/practice-session")

    assert response.status_code == 502
    assert response.json() == {"detail": "Could not start the voice session."}


@pytest.mark.asyncio
async def test_non_string_signed_url_is_rejected_without_server_error():
    def provider_response(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"signed_url": 42})

    async with make_test_client(provider_response) as client:
        response = await client.post("/api/practice-session")

    assert response.status_code == 502
    assert response.json() == {"detail": "Could not start the voice session."}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid_url",
    [
        "wss://api.elevenlabs.io/v1/convai/conversation?agent_id=other&conversation_signature=token",
        "wss://api.elevenlabs.io/v1/convai/conversation?agent_id=agent_test",
        "wss://user:pass@api.elevenlabs.io/v1/convai/conversation?agent_id=agent_test&conversation_signature=token",
    ],
)
async def test_signed_url_must_target_requested_agent_with_a_signature(invalid_url):
    def provider_response(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"signed_url": invalid_url})

    async with make_test_client(provider_response) as client:
        response = await client.post("/api/practice-session")

    assert response.status_code == 502
    assert response.json() == {"detail": "Could not start the voice session."}


@pytest.mark.asyncio
async def test_fourth_session_request_within_window_is_rate_limited():
    calls = []

    def provider_response(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return httpx.Response(200, json={"signed_url": SIGNED_URL})

    async with make_test_client(provider_response) as client:
        statuses = [(await client.post("/api/practice-session")).status_code for _ in range(4)]
        response = await client.post("/api/practice-session")

    assert statuses == [200, 200, 200, 429]
    assert response.status_code == 429
    assert int(response.headers["retry-after"]) > 0
    assert len(calls) == 3


def test_rate_limit_expires_after_fifteen_minutes():
    now = [1000.0]
    limiter = SlidingWindowRateLimiter(limit=3, window_seconds=900, clock=lambda: now[0])

    assert [limiter.take("client-a") for _ in range(3)] == [None, None, None]
    assert limiter.take("client-a") == 900
    assert limiter.take("client-b") is None

    now[0] += 900
    assert limiter.take("client-a") is None
