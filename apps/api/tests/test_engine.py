import pytest

from app.modules.recommendations.engine import compose, signature, total
from app.modules.stylist.service import parse_text


@pytest.mark.parametrize(
    "text,expected",
    [
        ("dưới 1,5 triệu", 1500000),
        ("under 1.5m", 1500000),
        ("500k", 500000),
        ("ngân sách 1 500 000 VND", 1500000),
        ("1500000", 1500000),
    ],
)
def test_money_parser(text, expected):
    assert parse_text(text)["budget_max_vnd"] == expected


def test_parser_detects_context_and_ambiguity():
    assert parse_text("Tôi đi phỏng vấn, tối giản")["occasion"] == "INTERVIEW"
    assert parse_text("Tôi đi phỏng vấn, tối giản")["style"] == "MINIMAL"
    assert parse_text("dưới 1.500")["ambiguous_budget"] is True


def item(slot, code, price, score):
    return {
        "slot_key": slot,
        "product_id": code,
        "product_code": code,
        "price_vnd": price,
        "score": score,
    }


def test_composer_keeps_cheapest_path_outside_top_k():
    slots = [{"slot_key": "top"}, {"slot_key": "bottom"}]
    ranked = {
        "top": [item("top", f"top{i}", 900, 1) for i in range(40)]
        + [item("top", "cheap", 100, 0.1)],
        "bottom": [item("bottom", "bottom", 200, 0.5)],
    }
    looks, _, status = compose(slots, ranked, 300)
    assert status == "COMPLETE"
    assert len(looks) == 1
    assert total(looks[0][1]) == 300


def test_budget_checked_for_complete_outfit():
    looks, diagnostics, status = compose(
        [{"slot_key": "top"}, {"slot_key": "bottom"}],
        {"top": [item("top", "a", 600, 1)], "bottom": [item("bottom", "b", 600, 1)]},
        1000,
    )
    assert status == "NO_RESULTS" and not looks
    assert diagnostics["minimum_feasible_budget_vnd"] == 1200


def test_distinct_deterministic_looks():
    slots = [{"slot_key": "top"}, {"slot_key": "bottom"}]
    ranked = {
        "top": [item("top", "a", 100, 0.9), item("top", "b", 110, 0.8)],
        "bottom": [item("bottom", "c", 120, 0.8), item("bottom", "d", 140, 0.7)],
    }
    first = compose(slots, ranked, 500)
    assert first == compose(slots, ranked, 500)
    assert len({signature(items) for _, items in first[0]}) == 3


def test_partial_missing_slot():
    looks, diagnostics, status = compose(
        [{"slot_key": "top"}, {"slot_key": "bottom"}],
        {"top": [item("top", "a", 100, 1)], "bottom": []},
        1000,
    )
    assert status == "PARTIAL" and diagnostics["missing_slots"] == ["bottom"] and not looks
