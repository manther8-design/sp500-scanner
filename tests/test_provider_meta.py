from providers.base import compute_completeness, market_cap_class


def test_completeness_does_not_treat_missing_as_zero():
    values = {
        "price": 100.0,
        "open": None,
        "high": None,
        "low": None,
        "previous_close": 99.0,
        "volume": None,
        "avg_volume": None,
        "vwap": None,
        "bid": None,
        "ask": None,
    }
    required = list(values.keys())
    completeness, missing = compute_completeness(values, required)
    assert completeness == 0.2
    assert "vwap" in missing
    assert "volume" in missing
    # Explicit: None stays missing — zero would incorrectly look complete
    assert 0 not in (values[k] for k in missing)


def test_zero_price_is_valid_value():
    values = {"price": 0.0, "volume": None}
    completeness, missing = compute_completeness(values, ["price", "volume"])
    assert completeness == 0.5
    assert missing == ["volume"]


def test_market_cap_class():
    assert market_cap_class(None) is None
    assert market_cap_class(500_000_000_000) == "mega"
    assert market_cap_class(15_000_000_000) == "large"
    assert market_cap_class(3_000_000_000) == "mid"
    assert market_cap_class(500_000_000) == "small"
    assert market_cap_class(50_000_000) == "micro"
