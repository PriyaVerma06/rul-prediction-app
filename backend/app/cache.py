"""Process-local in-memory TTL cache and sliding-window rate limiter for /explain.

NOTE: This implementation is process-local and suitable for single-instance or
containerized deployments. In multi-worker distributed production environments,
a centralized store like Redis or Memcached can be substituted transparently.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from typing import Any
from fastapi import HTTPException, Request, status

from app.config import EXPLAIN_CACHE_TTL_SECONDS, EXPLAIN_RATE_LIMIT_PER_MIN

logger = logging.getLogger("rul_api.cache")


class ExplainCache:
    """In-memory TTL cache for /explain responses."""

    def __init__(self, default_ttl: int = EXPLAIN_CACHE_TTL_SECONDS):
        self.default_ttl = default_ttl
        self._cache: dict[str, tuple[float, dict[str, Any]]] = {}

    @staticmethod
    def make_cache_key(
        readings: list[list[float]],
        audience: str = "general",
        language: str = "en",
    ) -> str:
        """Computes a deterministic SHA-256 hash of the request parameters."""
        raw_key = f"{json.dumps(readings, separators=(',', ':'))}:{audience.lower()}:{language.lower()}"
        return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    def get(self, key: str) -> dict[str, Any] | None:
        """Retrieves cached response if present and not expired."""
        now = time.time()
        entry = self._cache.get(key)
        if entry is None:
            return None

        expiry, data = entry
        if now > expiry:
            del self._cache[key]
            return None

        return data

    def set(self, key: str, data: dict[str, Any], ttl: int | None = None) -> None:
        """Stores a response with TTL."""
        expiry = time.time() + (ttl if ttl is not None else self.default_ttl)
        self._cache[key] = (expiry, data)

        # Basic size bound cleanup if cache exceeds 1000 items
        if len(self._cache) > 1000:
            self._cleanup_expired()

    def _cleanup_expired(self) -> None:
        """Removes expired entries."""
        now = time.time()
        expired_keys = [k for k, (exp, _) in self._cache.items() if now > exp]
        for k in expired_keys:
            del self._cache[k]

    def clear(self) -> None:
        """Clears all cached entries (useful for testing)."""
        self._cache.clear()


class InMemoryRateLimiter:
    """Sliding-window per-IP rate limiter."""

    def __init__(self, max_per_minute: int = EXPLAIN_RATE_LIMIT_PER_MIN):
        self.max_per_minute = max_per_minute
        self._requests: dict[str, list[float]] = {}

    def get_client_ip(self, request: Request) -> str:
        """Extracts client IP, honoring X-Forwarded-For if available."""
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        if request.client and request.client.host:
            return request.client.host
        return "127.0.0.1"

    def is_allowed(self, client_ip: str) -> bool:
        """Checks if client IP is within allowed request rate."""
        now = time.time()
        window_start = now - 60.0

        timestamps = self._requests.get(client_ip, [])
        # Retain only timestamps from the last 60 seconds
        valid_timestamps = [t for t in timestamps if t > window_start]

        if len(valid_timestamps) >= self.max_per_minute:
            self._requests[client_ip] = valid_timestamps
            return False

        valid_timestamps.append(now)
        self._requests[client_ip] = valid_timestamps
        return True

    def check_rate_limit(self, request: Request) -> None:
        """Enforces rate limit, raising HTTP 429 if exceeded."""
        client_ip = self.get_client_ip(request)
        if not self.is_allowed(client_ip):
            logger.warning("Rate limit exceeded for client IP %s (%d/min)", client_ip, self.max_per_minute)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit of {self.max_per_minute} requests per minute exceeded. Please retry later.",
                headers={"Retry-After": "60"},
            )

    def clear(self) -> None:
        """Resets all tracked request records (useful for testing)."""
        self._requests.clear()

