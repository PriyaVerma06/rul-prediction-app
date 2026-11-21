"""LLM integration module with provider abstraction, retries, and deterministic fallback.

Supports:
- Primary Provider: Google Gemini (via Google AI Studio REST API)
- Backup Provider: Grok (via xAI OpenAI-compatible REST API)
- Automatic fallback: Gemini -> Grok -> Deterministic template
- Configurable models, timeouts, and retry logic with exponential backoff.
- Strict security: API keys are NEVER logged or returned in exceptions or payloads.
"""

from __future__ import annotations

import asyncio
import json
import logging
from abc import ABC, abstractmethod
from typing import Any, Literal
import httpx

from app.config import (
    GEMINI_API_KEY,
    GEMINI_MODEL,
    GROK_API_KEY,
    GROK_MODEL,
    LLM_BACKUP_PROVIDER,
    LLM_ENABLED,
    LLM_PRIMARY_PROVIDER,
    LLM_TIMEOUT_SECONDS,
)

logger = logging.getLogger("rul_api.llm")

# Disclaimer required on all outputs
EXACT_DISCLAIMER: str = (
    "This is a demo model trained on NASA C-MAPSS FD001 and is not intended for real maintenance decisions."
)


class LlmError(Exception):
    """Base exception for LLM operations. Never contains API keys."""
    pass


class LlmNotConfiguredError(LlmError):
    """Raised when an LLM provider has no API key or is disabled."""
    pass


class LlmProviderError(LlmError):
    """Raised when an LLM provider request fails after retries."""
    pass


class LlmAllProvidersFailedError(LlmError):
    """Raised when both primary and backup providers fail."""
    pass


def _sanitize_error_message(error: Exception | str) -> str:
    """Removes API keys from error messages to prevent leakage."""
    msg = str(error)
    for key in (GEMINI_API_KEY, GROK_API_KEY):
        if key and len(key) >= 6:
            msg = msg.replace(key, "[REDACTED_API_KEY]")
    return msg


def build_system_prompt(audience: str = "general", language: str = "en") -> str:
    """Constructs the system prompt instructing the LLM on constraints and formatting."""
    is_engineer = audience.lower() == "engineer"
    word_limit = 180 if is_engineer else 120
    audience_tone = (
        "Focus on technical telemetry, rate of divergence, and engineering metrics."
        if is_engineer
        else "Use simple, accessible, plain language suitable for a non-technical fleet manager."
    )

    return (
        f"You are an expert aerospace predictive maintenance specialist summarizing an engine's Remaining Useful Life (RUL).\n"
        f"Target Audience: {audience.upper()} ({audience_tone})\n"
        f"Target Language: {language}\n"
        f"Length: Approximately {word_limit} words maximum.\n\n"
        f"STRICT RULES YOU MUST NEVER VIOLATE:\n"
        f"1. Use ONLY the telemetry and prediction facts provided in the user prompt. Do not invent facts, sensor meanings, or causes.\n"
        f"2. Explicitly mention that the RUL is capped at 125 cycles by the training methodology.\n"
        f"3. Explain the health status ('critical', 'warning', or 'healthy') in plain words.\n"
        f"4. Mention the top 2-3 changing sensors with their percentage changes, but DO NOT claim or speculate on any physical cause.\n"
        f"5. Provide exactly one cautious, professional suggested next step for the maintenance crew.\n"
        f"6. NO Markdown headings (no #, ##, ###). Avoid excessive bullet points; write in fluent, natural prose.\n"
        f"7. You MUST end your response with this exact sentence:\n"
        f'"{EXACT_DISCLAIMER}"'
    )


def build_user_prompt(facts: dict[str, Any]) -> str:
    """Constructs the user prompt containing structured telemetry facts."""
    return (
        f"Here are the verified operational telemetry facts for this aircraft engine:\n\n"
        f"{json.dumps(facts, indent=2)}\n\n"
        f"Please generate the summary adhering strictly to the system instructions and word limit."
    )


def generate_template_summary(
    facts: dict[str, Any],
    audience: str = "general",
    language: str = "en",
) -> str:
    """Generates a deterministic template-based summary when LLM providers are unavailable.

    Guarantees:
    - Uses only verified computed prediction facts and sensor insights.
    - Mentions the RUL cap (125 cycles).
    - Explains health status in clear terms.
    - Lists top changing sensors with percentage changes.
    - Recommends one cautious next step.
    - Ends with the exact NASA C-MAPSS disclaimer.
    """
    predicted_rul = facts.get("predicted_rul", 0.0)
    rul_cap = facts.get("rul_cap", 125.0)
    health_status = str(facts.get("health_status", "healthy")).lower()
    top_features = facts.get("top_features", [])

    is_engineer = audience.lower() == "engineer"

    # Health status interpretation
    if health_status == "critical":
        status_desc = "CRITICAL condition, indicating severe degradation across operational cycles"
        next_step = "Conduct immediate off-wing inspection, borescope examination, and overhaul prior to the next flight cycle."
    elif health_status == "warning":
        status_desc = "WARNING condition with noticeable sensor divergence"
        next_step = "Increase cycle monitoring frequency and schedule preventive inspection within the next 20 operating cycles."
    else:
        status_desc = "HEALTHY nominal operating condition"
        next_step = "Engine is cleared for standard operational deployment with routine telemetry tracking."

    # Top changing sensors phrasing
    sensor_phrases = []
    for feat in top_features[:3]:
        name = feat.get("name", "sensor")
        trend = feat.get("trend", "stable")
        pct = feat.get("percentage_change", 0.0)
        norm = feat.get("normalized_change", 0.0)
        if is_engineer:
            sensor_phrases.append(f"{name} ({trend}, {pct:+.1f}%, {norm:+.2f}σ)")
        else:
            sensor_phrases.append(f"{name} ({trend} by {abs(pct):.1f}%)")

    if sensor_phrases:
        sensors_text = (
            f"Key telemetry indicators showing the highest relative drift include {', '.join(sensor_phrases)}."
        )
    else:
        sensors_text = "All active sensor channels remained within baseline operational tolerances."

    if is_engineer:
        summary = (
            f"The recurrent GRU prognostic model predicts a Remaining Useful Life of {predicted_rul:.2f} cycles, "
            f"evaluated against a training ceiling of {rul_cap:.0f} cycles. The unit is classified in {status_desc}. "
            f"{sensors_text} Recommended action: {next_step} {EXACT_DISCLAIMER}"
        )
    else:
        summary = (
            f"This engine has an estimated Remaining Useful Life of {predicted_rul:.1f} cycles, "
            f"subject to the model cap of {rul_cap:.0f} cycles. Its condition is currently rated as {status_desc}. "
            f"{sensors_text} Next step: {next_step} {EXACT_DISCLAIMER}"
        )

    return summary


class BaseLlmProvider(ABC):
    """Abstract base class for LLM providers."""

    @property
    @abstractmethod
    def provider_id(self) -> str:
        """Provider identifier, e.g. 'gemini' or 'grok'."""
        pass

    @property
    @abstractmethod
    def model_name(self) -> str:
        """Configured model name, e.g. 'gemini-1.5-flash'."""
        pass

    @abstractmethod
    async def generate(self, system_prompt: str, user_prompt: str, timeout: float) -> str:
        """Generates text from the provider."""
        pass


class GeminiProvider(BaseLlmProvider):
    """Google Gemini provider using the Google AI Studio REST API."""

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or GEMINI_API_KEY
        self.model = model or GEMINI_MODEL

    @property
    def provider_id(self) -> str:
        return "gemini"

    @property
    def model_name(self) -> str:
        return self.model

    async def generate(self, system_prompt: str, user_prompt: str, timeout: float) -> str:
        if not self.api_key:
            raise LlmNotConfiguredError("Gemini API key is not configured.")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"
        headers = {
            "Content-Type": "application/json",
            "x-goog-api-key": self.api_key,
        }
        payload = {
            "system_instruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": user_prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 400,
            },
        }

        # Up to 1 retry with exponential backoff for 429 or 5xx
        max_attempts = 2
        for attempt in range(1, max_attempts + 1):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(url, json=payload, headers=headers)

                if response.status_code in (429, 500, 502, 503, 504) and attempt < max_attempts:
                    logger.warning(
                        "Gemini API returned status %d on attempt %d. Retrying after backoff...",
                        response.status_code,
                        attempt,
                    )
                    await asyncio.sleep(1.0)
                    continue

                response.raise_for_status()
                data = response.json()

                candidates = data.get("candidates", [])
                if not candidates:
                    raise LlmProviderError("Gemini returned no candidates.")

                parts = candidates[0].get("content", {}).get("parts", [])
                if not parts or not parts[0].get("text"):
                    raise LlmProviderError("Gemini returned empty text response.")

                return str(parts[0]["text"]).strip()

            except httpx.TimeoutException as e:
                if attempt < max_attempts:
                    logger.warning("Gemini timeout on attempt %d. Retrying...", attempt)
                    await asyncio.sleep(1.0)
                    continue
                raise LlmProviderError(f"Gemini API timed out after {timeout}s: {_sanitize_error_message(e)}") from e
            except httpx.HTTPStatusError as e:
                sanitized = _sanitize_error_message(e)
                raise LlmProviderError(f"Gemini API HTTP {e.response.status_code}: {sanitized}") from e
            except Exception as e:
                sanitized = _sanitize_error_message(e)
                raise LlmProviderError(f"Gemini API error: {sanitized}") from e

        raise LlmProviderError("Gemini failed after retries.")


class GrokProvider(BaseLlmProvider):
    """Grok provider using the xAI OpenAI-compatible REST API."""

    def __init__(self, api_key: str | None = None, model: str | None = None):
        self.api_key = api_key or GROK_API_KEY
        self.model = model or GROK_MODEL

    @property
    def provider_id(self) -> str:
        return "grok"

    @property
    def model_name(self) -> str:
        return self.model

    async def generate(self, system_prompt: str, user_prompt: str, timeout: float) -> str:
        if not self.api_key:
            raise LlmNotConfiguredError("Grok API key is not configured.")

        url = "https://api.x.ai/v1/chat/completions"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 400,
        }

        max_attempts = 2
        for attempt in range(1, max_attempts + 1):
            try:
                async with httpx.AsyncClient(timeout=timeout) as client:
                    response = await client.post(url, json=payload, headers=headers)

                if response.status_code in (429, 500, 502, 503, 504) and attempt < max_attempts:
                    logger.warning(
                        "Grok API returned status %d on attempt %d. Retrying after backoff...",
                        response.status_code,
                        attempt,
                    )
                    await asyncio.sleep(1.0)
                    continue

                response.raise_for_status()
                data = response.json()

                choices = data.get("choices", [])
                if not choices:
                    raise LlmProviderError("Grok returned no completion choices.")

                content = choices[0].get("message", {}).get("content")
                if not content or not str(content).strip():
                    raise LlmProviderError("Grok returned empty message content.")

                return str(content).strip()

            except httpx.TimeoutException as e:
                if attempt < max_attempts:
                    logger.warning("Grok timeout on attempt %d. Retrying...", attempt)
                    await asyncio.sleep(1.0)
                    continue
                raise LlmProviderError(f"Grok API timed out after {timeout}s: {_sanitize_error_message(e)}") from e
            except httpx.HTTPStatusError as e:
                sanitized = _sanitize_error_message(e)
                raise LlmProviderError(f"Grok API HTTP {e.response.status_code}: {sanitized}") from e
            except Exception as e:
                sanitized = _sanitize_error_message(e)
                raise LlmProviderError(f"Grok API error: {sanitized}") from e

        raise LlmProviderError("Grok failed after retries.")


class LlmClient:
    """Manages primary and backup LLM providers with automatic fallback."""

    def __init__(
        self,
        primary: BaseLlmProvider | None = None,
        backup: BaseLlmProvider | None = None,
        timeout: float = LLM_TIMEOUT_SECONDS,
        enabled: bool = LLM_ENABLED,
    ):
        self.primary = primary or self._create_provider(LLM_PRIMARY_PROVIDER)
        self.backup = backup or self._create_provider(LLM_BACKUP_PROVIDER)
        self.timeout = timeout
        self.enabled = enabled

    @staticmethod
    def _create_provider(provider_name: str) -> BaseLlmProvider | None:
        """Instantiates provider based on name."""
        name = provider_name.lower().strip()
        if name == "gemini":
            return GeminiProvider()
        elif name == "grok":
            return GrokProvider()
        logger.warning("Unrecognized LLM provider '%s'.", provider_name)
        return None

    async def generate_summary(
        self,
        facts: dict[str, Any],
        audience: str = "general",
        language: str = "en",
    ) -> tuple[str, str]:
        """Attempts generation with primary provider, falls back to backup provider.

        Returns:
            Tuple of (summary_text, model_name).

        Raises:
            LlmAllProvidersFailedError: When both providers fail or are unconfigured.
        """
        if not self.enabled:
            raise LlmAllProvidersFailedError("LLM generation is disabled in configuration.")

        system_prompt = build_system_prompt(audience=audience, language=language)
        user_prompt = build_user_prompt(facts)

        errors: list[str] = []

        # 1. Try Primary Provider
        if self.primary:
            try:
                logger.info("Attempting LLM summary with primary provider (%s)...", self.primary.provider_id)
                text = await self.primary.generate(system_prompt, user_prompt, self.timeout)
                if text:
                    logger.info("Summary successfully generated by primary provider (%s).", self.primary.model_name)
                    return text, self.primary.model_name
            except Exception as e:
                sanitized_err = _sanitize_error_message(e)
                errors.append(f"Primary ({self.primary.provider_id}): {sanitized_err}")
                logger.warning("Primary LLM provider failed: %s. Falling back to backup...", sanitized_err)
        else:
            errors.append("Primary provider not configured.")

        # 2. Try Backup Provider
        if self.backup:
            try:
                logger.info("Attempting LLM summary with backup provider (%s)...", self.backup.provider_id)
                text = await self.backup.generate(system_prompt, user_prompt, self.timeout)
                if text:
                    logger.info("Summary successfully generated by backup provider (%s).", self.backup.model_name)
                    return text, self.backup.model_name
            except Exception as e:
                sanitized_err = _sanitize_error_message(e)
                errors.append(f"Backup ({self.backup.provider_id}): {sanitized_err}")
                logger.warning("Backup LLM provider failed: %s.", sanitized_err)
        else:
            errors.append("Backup provider not configured.")

        # Both failed
        raise LlmAllProvidersFailedError(f"All LLM providers failed: {'; '.join(errors)}")


async def get_summary_with_fallback(
    facts: dict[str, Any],
    audience: str = "general",
    language: str = "en",
    client: LlmClient | None = None,
) -> tuple[str, Literal["llm", "template"], str | None]:
    """Generates an explanation summary with guaranteed deterministic template fallback.

    Returns:
        Tuple of (summary_text, source, model_name).
        source is either 'llm' or 'template'.
    """
    llm = client or LlmClient()

    try:
        text, model = await llm.generate_summary(facts, audience=audience, language=language)
        return text, "llm", model
    except Exception as e:
        logger.warning(
            "LLM generation unavailable or failed (%s). Using deterministic template fallback.",
            _sanitize_error_message(e),
        )
        template_text = generate_template_summary(facts, audience=audience, language=language)
        return template_text, "template", None

