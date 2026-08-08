from __future__ import annotations

import hashlib
import logging
import threading
import time
from collections import defaultdict, deque

from fastapi import Request
from redis import Redis
from redis.exceptions import RedisError

from app.config import settings

logger = logging.getLogger(__name__)


def client_ip(request: Request) -> str:
    direct = request.client.host if request.client else "unknown"
    if settings.trusted_proxy_hops <= 0:
        return direct

    forwarded = [part.strip() for part in request.headers.get("x-forwarded-for", "").split(",")]
    forwarded = [part for part in forwarded if part]
    if len(forwarded) < settings.trusted_proxy_hops:
        return direct
    return forwarded[-settings.trusted_proxy_hops]


class SearchRateLimiter:
    def __init__(self, limit: int, window_seconds: int = 60, redis_url: str = ""):
        self.limit = limit
        self.window_seconds = window_seconds
        self._local: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()
        self._last_cleanup = time.time()
        self._redis = (
            Redis.from_url(redis_url, socket_connect_timeout=1, socket_timeout=1)
            if redis_url
            else None
        )

    @staticmethod
    def _key(identifier: str) -> str:
        digest = hashlib.sha256(identifier.encode("utf-8")).hexdigest()
        return f"smartgallery:public-search:{digest}"

    def check(self, identifier: str) -> tuple[bool, int]:
        key = self._key(identifier)
        now = time.time()
        if self._redis is not None:
            try:
                bucket = int(now // self.window_seconds)
                redis_key = f"{key}:{bucket}"
                pipe = self._redis.pipeline(transaction=True)
                pipe.incr(redis_key)
                pipe.expire(redis_key, self.window_seconds + 1)
                count, _ = pipe.execute()
                retry_after = self.window_seconds - int(now % self.window_seconds)
                return int(count) <= self.limit, max(retry_after, 1)
            except RedisError:
                logger.warning("Redis rate limiter unavailable; using local fallback")

        cutoff = now - self.window_seconds
        with self._lock:
            if now - self._last_cleanup >= self.window_seconds:
                for existing_key, existing_entries in list(self._local.items()):
                    while existing_entries and existing_entries[0] <= cutoff:
                        existing_entries.popleft()
                    if not existing_entries:
                        del self._local[existing_key]
                self._last_cleanup = now
            entries = self._local[key]
            while entries and entries[0] <= cutoff:
                entries.popleft()
            if len(entries) >= self.limit:
                return False, max(int(entries[0] + self.window_seconds - now) + 1, 1)
            entries.append(now)
            return True, 0


public_search_limiter = SearchRateLimiter(
    limit=settings.public_searches_per_minute,
    redis_url=settings.redis_url,
)
