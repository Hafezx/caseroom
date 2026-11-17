"""An in-memory limit for the small demo's session issuance endpoint."""

from collections import defaultdict, deque
from math import ceil
from threading import Lock
from time import monotonic
from typing import Callable


class SlidingWindowRateLimiter:
    def __init__(
        self,
        limit: int,
        window_seconds: int,
        clock: Callable[[], float] = monotonic,
    ):
        self.limit = limit
        self.window_seconds = window_seconds
        self.clock = clock
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def take(self, key: str) -> int | None:
        now = self.clock()
        with self._lock:
            events = self._events[key]
            while events and events[0] <= now - self.window_seconds:
                events.popleft()
            if len(events) >= self.limit:
                return max(1, ceil(events[0] + self.window_seconds - now))
            events.append(now)
            return None
