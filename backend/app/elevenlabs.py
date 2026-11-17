"""Small, server-side boundary around ElevenLabs session authentication."""

from urllib.parse import parse_qs, urlsplit

import httpx


SIGNED_URL_ENDPOINT = (
    "https://api.elevenlabs.io/v1/convai/conversation/get-signed-url"
)


class ElevenLabsServiceError(Exception):
    """A safe-to-catch provider failure; details stay inside this boundary."""


class ElevenLabsClient:
    def __init__(
        self,
        api_key: str,
        transport: httpx.AsyncBaseTransport | None = None,
        timeout_seconds: float = 10.0,
    ):
        self.api_key = api_key
        self.transport = transport
        self.timeout_seconds = timeout_seconds

    async def get_signed_url(self, agent_id: str) -> str:
        try:
            async with httpx.AsyncClient(
                transport=self.transport,
                timeout=self.timeout_seconds,
            ) as client:
                response = await client.get(
                    SIGNED_URL_ENDPOINT,
                    params={"agent_id": agent_id},
                    headers={"xi-api-key": self.api_key, "accept": "application/json"},
                )
            response.raise_for_status()
            payload = response.json()
            signed_url = payload["signed_url"]
            if not isinstance(signed_url, str):
                raise ValueError("invalid signed URL")
            parsed = urlsplit(signed_url)
            query = parse_qs(parsed.query)
            signature = query.get("conversation_signature") or query.get("token")
            if (
                parsed.scheme != "wss"
                or parsed.hostname != "api.elevenlabs.io"
                or parsed.path != "/v1/convai/conversation"
                or parsed.username is not None
                or parsed.password is not None
                or query.get("agent_id") != [agent_id]
                or not signature
            ):
                raise ValueError("invalid signed URL")
            return signed_url
        except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
            raise ElevenLabsServiceError from exc
