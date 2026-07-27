"""Model rate resolution and the published constants it resolves to.

The rate table feeds the per-stream-hour cost quoted in customer-facing
material, so both halves are pinned here: the published numbers, and the lookup
that decides which row a model id lands on.
"""

from __future__ import annotations

import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.genai_client import (  # noqa: E402, I001
    MODEL_RATES,
    estimate_cost,
    rates_for,
)

# -- resolution ---------------------------------------------------------


def test_exact_id_resolves_to_its_own_row():
    r = rates_for("gemini-3.5-flash-lite")
    assert (r.input_per_m, r.output_per_m) == (0.30, 2.50)


def test_suffixed_flash_lite_does_not_fall_through_to_plain_flash():
    """The regression this test exists for.

    `gemini-3.5-flash-lite-preview-01` prefix-matches both `gemini-3.5-flash`
    and `gemini-3.5-flash-lite`. Resolution used to take the first match in dict
    insertion order, which is the plain Flash row — 5x the input and 3.6x the
    output of the Lite row. Anyone pointing GEMINI_TRIAGE_MODEL at a dated or
    preview Lite variant would have silently inflated every triage cost, and the
    triage tier is what the tiered stream-hour figure rests on.
    """
    lite = rates_for("gemini-3.5-flash-lite")
    for variant in (
        "gemini-3.5-flash-lite-preview-01",
        "gemini-3.5-flash-lite-002",
        "gemini-3.5-flash-lite-latest",
    ):
        r = rates_for(variant)
        assert (r.input_per_m, r.output_per_m) == (
            lite.input_per_m,
            lite.output_per_m,
        ), (
            f"{variant} resolved to {r.input_per_m}/{r.output_per_m}, "
            f"expected the flash-lite row {lite.input_per_m}/{lite.output_per_m}"
        )


def test_suffixed_plain_flash_still_resolves_to_plain_flash():
    r = rates_for("gemini-3.5-flash-002")
    assert (r.input_per_m, r.output_per_m) == (1.50, 9.00)


def test_longest_prefix_wins_regardless_of_declaration_order():
    """Resolution must not depend on how MODEL_RATES happens to be ordered."""
    for known in MODEL_RATES:
        r = rates_for(known + "-preview-99")
        expected = MODEL_RATES[known]
        assert r.input_per_m == expected.input_per_m
        assert r.output_per_m == expected.output_per_m


def test_unknown_model_falls_back_to_flash_class_estimate():
    r = rates_for("some-other-vendor-model")
    assert (r.input_per_m, r.output_per_m) == (1.50, 7.50)


# -- published constants ------------------------------------------------


@pytest.mark.parametrize(
    "model,input_per_m,output_per_m,cached_per_m",
    [
        # Confirmed against ai.google.dev/gemini-api/docs/pricing, 2026-07-27.
        ("gemini-3.1-pro-preview", 2.00, 12.00, 0.20),
        ("gemini-3.5-flash", 1.50, 9.00, 0.15),
        ("gemini-3.1-flash-lite", 0.25, 1.50, 0.025),
    ],
)
def test_published_rates_match_the_price_list(
    model, input_per_m, output_per_m, cached_per_m
):
    r = rates_for(model)
    assert r.input_per_m == input_per_m
    assert r.output_per_m == output_per_m
    assert r.cached_input_per_m == cached_per_m


def test_pro_long_context_tier():
    r = rates_for("gemini-3.1-pro-preview")
    assert (r.long_input_per_m, r.long_output_per_m) == (4.00, 18.00)
    assert r.long_context_threshold == 200_000


def test_long_context_tier_applies_above_the_threshold():
    below = estimate_cost("gemini-3.1-pro-preview", 100_000, 1_000)
    above = estimate_cost("gemini-3.1-pro-preview", 300_000, 1_000)
    assert above > below
    # 300k input at the long rate, plus output at the long output rate.
    assert above == pytest.approx(300_000 / 1e6 * 4.00 + 1_000 / 1e6 * 18.00)


def test_cached_tokens_are_billed_at_the_cached_rate():
    cost = estimate_cost("gemini-3.5-flash", 1_000_000, 0, cached_tokens=1_000_000)
    assert cost == pytest.approx(0.15)
