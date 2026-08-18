"""Small sliding-window rate limiter, in-memory.

Per-process only: fine for a single uvicorn worker and for tests, and it keeps
verification-code abuse cheap to reason about. Swap for Redis when running
multiple workers behind a load balancer.
"""

import time
from collections import defaultdict, deque
from threading import Lock


class SlidingWindow:
    def __init__(self, window_seconds: int, max_hits: int) -> None:
        self.window_seconds = window_seconds
        self.max_hits = max_hits
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def hit(self, key: str) -> bool:
        """Record a hit; return False when the window is over the limit."""
        now = time.monotonic()
        with self._lock:
            bucket = self._hits[key]
            while bucket and bucket[0] <= now - self.window_seconds:
                bucket.popleft()
            if len(bucket) >= self.max_hits:
                return False
            bucket.append(now)
            return True
