# test_logic.py
from backend.logic import calculate_weighted_sum, calculate_score_range

def test_calculate_weighted_sum():
    weights = {1: 2.0, 2: 4.0}
    ratings = [
        {"alternative_id": 10, "criterion_id": 1, "value": 9.0},
        {"alternative_id": 10, "criterion_id": 2, "value": 4.0},
    ]
    result = calculate_weighted_sum(weights, ratings)
    assert result == {10: 34.0}

def test_calculate_weighted_sum_missing_weight():
    weights = {1: 2.0}
    ratings = [{"alternative_id": 10, "criterion_id": 99, "value": 5.0}]
    result = calculate_weighted_sum(weights, ratings)
    assert result == {10: 0.0}  # weight defaults to 0
    
def test_calculate_score_range():
    weights = {1: {"min": 2.0, "max": 5.0}, 2: {"min": 3.0, "max": 4.0}}
    ratings = {1: {1: {"min": 3, "max": 5}, 2: {"min": 1, "max": 1}}, 2: {1: {"min": 3, "max": 5}, 2: {"min": 4, "max": 4}}}
    result = calculate_score_range(weights, ratings)
    
    # --- alt 1 ---
    assert result[1]["min_score"] == 9
    assert result[1]["max_score"] == 29
    assert result[1]["span"] == 20
    assert result[1]["criterion_impact"][1]["span_before"] == 20
    assert result[1]["criterion_impact"][1]["span_after"]  == 1
    assert result[1]["criterion_impact"][1]["reduction"]   == 19
    assert result[1]["criterion_impact"][2]["span_before"] == 20
    assert result[1]["criterion_impact"][2]["span_after"]  == 19
    assert result[1]["criterion_impact"][2]["reduction"]   == 1
    
    # --- alt 2 ---
    assert result[2]["min_score"] == 18
    assert result[2]["max_score"] == 41
    assert result[2]["span"] == 23
    assert result[2]["criterion_impact"][1]["span_before"] == 23
    assert result[2]["criterion_impact"][1]["span_after"]  == 4
    assert result[2]["criterion_impact"][1]["reduction"]   == 19
    assert result[2]["criterion_impact"][2]["span_before"] == 23
    assert result[2]["criterion_impact"][2]["span_after"]  == 19
    assert result[2]["criterion_impact"][2]["reduction"]   == 4