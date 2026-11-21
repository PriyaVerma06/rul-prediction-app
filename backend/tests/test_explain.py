"""Automated test suite for /explain endpoint and LLM fallback logic."""

import asyncio
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient
import httpx

from app.cache import ExplainCache, InMemoryRateLimiter
from app.config import RUL_CAP, WINDOW_SIZE
from app.llm import (
    EXACT_DISCLAIMER,
    BaseLlmProvider,
    GeminiProvider,
    GrokProvider,
    LlmAllProvidersFailedError,
    LlmClient,
    LlmProviderError,
    build_system_prompt,
    build_user_prompt,
    generate_template_summary,
    get_summary_with_fallback,
)
from app.main import app
from app.schemas import generate_sample_window


@pytest.fixture(scope="module")
def client():
    """Module-scoped test client that runs the FastAPI lifespan startup and shutdown."""
    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def reset_cache_and_limiter():
    """Resets cache and rate limiter before each test."""
    if hasattr(app.state, "explain_cache") and app.state.explain_cache:
        app.state.explain_cache.clear()
    if hasattr(app.state, "rate_limiter") and app.state.rate_limiter:
        app.state.rate_limiter.clear()


@pytest.fixture
def sample_facts():
    return {
        "predicted_rul": 45.2,
        "rul_cap": 125.0,
        "health_status": "warning",
        "health_thresholds": {"critical_lte": 30.0, "warning_lte": 75.0},
        "top_features": [
            {
                "name": "sensor_4",
                "trend": "rising",
                "percentage_change": 2.45,
                "normalized_change": 1.25,
            },
            {
                "name": "sensor_11",
                "trend": "falling",
                "percentage_change": -1.80,
                "normalized_change": -0.95,
            },
        ],
        "constant_features": ["setting_3", "sensor_1"],
    }


# ============================================================================
# 1. Deterministic Template Fallback & Prompt Verification Tests
# ============================================================================

def test_template_summary_contains_required_elements(sample_facts):
    """Deterministic template summary must satisfy all required prompt conditions."""
    summary_gen = generate_template_summary(sample_facts, audience="general")
    assert EXACT_DISCLAIMER in summary_gen
    assert "45.2" in summary_gen
    assert "125" in summary_gen
    assert "WARNING" in summary_gen
    assert "sensor_4" in summary_gen

    summary_eng = generate_template_summary(sample_facts, audience="engineer")
    assert EXACT_DISCLAIMER in summary_eng
    assert "45.20" in summary_eng
    assert "sensor_4" in summary_eng
    assert "σ" in summary_eng  # Normalized sigma in technical view


def test_system_prompt_builder():
    """System prompt builder formats rules and disclaimers correctly."""
    prompt_gen = build_system_prompt(audience="general")
    assert "120 words" in prompt_gen
    assert EXACT_DISCLAIMER in prompt_gen
    assert "NO Markdown headings" in prompt_gen

    prompt_eng = build_system_prompt(audience="engineer")
    assert "180 words" in prompt_eng
    assert "technical telemetry" in prompt_eng


# ============================================================================
# 2. LLM Provider Fallback Logic Tests (Mocked)
# ============================================================================

def test_grok_fallback_when_gemini_fails(sample_facts):
    """When Gemini raises an error, Grok must be tried and succeed."""
    async def _test():
        mock_gemini = AsyncMock(spec=BaseLlmProvider)
        mock_gemini.provider_id = "gemini"
        mock_gemini.model_name = "gemini-1.5-flash"
        mock_gemini.generate.side_effect = LlmProviderError("Gemini server error 500")

        mock_grok = AsyncMock(spec=BaseLlmProvider)
        mock_grok.provider_id = "grok"
        mock_grok.model_name = "grok-beta"
        mock_grok.generate.return_value = f"Grok generated summary. {EXACT_DISCLAIMER}"

        client = LlmClient(primary=mock_gemini, backup=mock_grok, enabled=True)
        text, model = await client.generate_summary(sample_facts)

        assert text.startswith("Grok generated summary")
        assert model == "grok-beta"
        assert mock_gemini.generate.called
        assert mock_grok.generate.called

    asyncio.run(_test())


def test_template_fallback_when_gemini_times_out(sample_facts):
    """When Gemini times out and Grok is unconfigured/fails, template fallback is used."""
    async def _test():
        mock_gemini = AsyncMock(spec=BaseLlmProvider)
        mock_gemini.provider_id = "gemini"
        mock_gemini.model_name = "gemini-1.5-flash"
        mock_gemini.generate.side_effect = LlmProviderError("Gemini timed out after 15s")

        mock_grok = AsyncMock(spec=BaseLlmProvider)
        mock_grok.provider_id = "grok"
        mock_grok.generate.side_effect = LlmProviderError("Grok also timed out")

        client = LlmClient(primary=mock_gemini, backup=mock_grok, enabled=True)
        text, source, model = await get_summary_with_fallback(sample_facts, client=client)

        assert source == "template"
        assert model is None
        assert EXACT_DISCLAIMER in text

    asyncio.run(_test())


def test_template_fallback_on_http_429(sample_facts):
    """When both providers hit rate limits (429), template fallback is used."""
    async def _test():
        mock_gemini = AsyncMock(spec=BaseLlmProvider)
        mock_gemini.provider_id = "gemini"
        mock_gemini.generate.side_effect = LlmProviderError("Gemini HTTP 429: Resource has been exhausted")

        mock_grok = AsyncMock(spec=BaseLlmProvider)
        mock_grok.provider_id = "grok"
        mock_grok.generate.side_effect = LlmProviderError("Grok HTTP 429: Too Many Requests")

        client = LlmClient(primary=mock_gemini, backup=mock_grok, enabled=True)
        text, source, model = await get_summary_with_fallback(sample_facts, client=client)

        assert source == "template"
        assert model is None
        assert EXACT_DISCLAIMER in text

    asyncio.run(_test())



# ============================================================================
# 3. Endpoint POST /explain Tests
# ============================================================================

def test_explain_endpoint_success_template_fallback(client):
    """POST /explain succeeds (HTTP 200) with template fallback when keys are absent."""
    payload = {
        "readings": generate_sample_window(),
        "audience": "general",
        "language": "en",
    }
    response = client.post("/explain", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert "summary" in data
    assert data["source"] in ("llm", "template")
    assert "facts" in data
    assert data["facts"]["rul_cap"] == RUL_CAP
    assert "top_features" in data["facts"]
    assert EXACT_DISCLAIMER in data["summary"]


def test_explain_endpoint_with_mocked_llm_success(client):
    """POST /explain returns source='llm' and model identifier when LLM succeeds."""
    mock_response = f"AI generated telemetry prognosis. {EXACT_DISCLAIMER}"

    with patch(
        "app.main.get_summary_with_fallback",
        new=AsyncMock(return_value=(mock_response, "llm", "gemini-1.5-flash")),
    ):
        payload = {
            "readings": generate_sample_window(),
            "audience": "engineer",
            "language": "en",
        }
        response = client.post("/explain", json=payload)
        assert response.status_code == 200
        data = response.json()

        assert data["source"] == "llm"
        assert data["model"] == "gemini-1.5-flash"
        assert data["summary"] == mock_response
        assert "predicted_rul" in data["facts"]


def test_explain_endpoint_cache_hit(client):
    """Subsequent identical requests are served from in-memory cache."""
    payload = {
        "readings": generate_sample_window(),
        "audience": "general",
        "language": "en",
    }

    # First request
    res1 = client.post("/explain", json=payload)
    assert res1.status_code == 200
    data1 = res1.json()

    # Second request with mock ensuring LLM is NOT called again
    with patch("app.main.get_summary_with_fallback") as mock_fallback:
        res2 = client.post("/explain", json=payload)
        assert res2.status_code == 200
        data2 = res2.json()

        # Cache hit: fallback generator was never invoked
        mock_fallback.assert_not_called()
        assert data1["summary"] == data2["summary"]
        assert data1["source"] == data2["source"]


def test_explain_endpoint_rate_limiting(client):
    """Exceeding EXPLAIN_RATE_LIMIT_PER_MIN triggers HTTP 429."""
    limiter = app.state.rate_limiter
    # Temporarily set limit to 3 for testing
    original_limit = limiter.max_per_minute
    limiter.max_per_minute = 3

    try:
        payload = {
            "readings": generate_sample_window(),
            "audience": "general",
            "language": "en",
        }
        # First 3 succeed
        for i in range(3):
            # Vary audience slightly to avoid cache hits during rate limit test
            p = {**payload, "language": f"lang_{i}"}
            resp = client.post("/explain", json=p)
            assert resp.status_code == 200

        # 4th request must be rate-limited (HTTP 429)
        p = {**payload, "language": "lang_exceed"}
        resp = client.post("/explain", json=p)
        assert resp.status_code == 429
        assert "Rate limit" in resp.json()["detail"]
        assert "Retry-After" in resp.headers
    finally:
        limiter.max_per_minute = original_limit


def test_explain_endpoint_validation_errors(client):
    """Invalid input cycles or features trigger HTTP 422."""
    # 29 cycles instead of 30
    bad_payload = {"readings": generate_sample_window()[:29]}
    resp = client.post("/explain", json=bad_payload)
    assert resp.status_code == 422

    # Non-numeric value in cycle
    corrupt_window = generate_sample_window()
    corrupt_window[0][0] = "invalid_string"  # type: ignore
    resp = client.post("/explain", json={"readings": corrupt_window})
    assert resp.status_code == 422


def test_api_key_never_leaked_in_responses_or_errors():
    """Verify API keys are never exposed in exceptions or sanitization."""
    from app.llm import _sanitize_error_message

    fake_secret = "AIzaSyFakeSecretGeminiKey12345"
    with patch("app.llm.GEMINI_API_KEY", fake_secret):
        raw_error = f"Connection failed to url https://api.com?key={fake_secret}"
        sanitized = _sanitize_error_message(raw_error)
        assert fake_secret not in sanitized
        assert "[REDACTED_API_KEY]" in sanitized


def test_predict_remains_independent_of_llm(client):
    """POST /predict continues functioning normally regardless of LLM configuration."""
    payload = {"readings": generate_sample_window()}
    resp = client.post("/predict", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "predicted_rul" in data
    assert "health_status" in data
    # /predict should NOT contain LLM fields
    assert "summary" not in data
    assert "source" not in data
