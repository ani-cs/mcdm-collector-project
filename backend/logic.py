from typing import Any, Dict, List

def calculate_weighted_sum(weights: Dict[int, float],
                           ratings: List[Dict[str, Any]]
                           ) -> Dict[int, float]:
    
    scores: Dict[int, float] = {}
    
    for rating in ratings:
        alt_id = rating["alternative_id"]
        crit_id = rating["criterion_id"]
        val = rating["value"]
        
        weight = weights.get(crit_id, 0.0)
    
        weighted_val = val * weight
    
        if alt_id not in scores:
            scores[alt_id] = 0.0
    
        scores[alt_id] += weighted_val
    
    return scores

def calculate_score_range(weights: Dict[int, dict], # {criterion_id: {"min": x, "max": y}}
                          ratings: Dict[int, dict]  # {alternative_id: {criterion_id: {"min": x, "max": y}}}
) -> Dict:
    results = {}
    
    for alt_id, criteria in ratings.items():
        
        # Calculate min and max possible scores
        min_score = sum(
            weights[int(crit_id)]["min"] * bounds["min"]
            for crit_id, bounds in criteria.items()
            if int(crit_id) in weights
        )
        
        max_score = sum(
            weights[int(crit_id)]["max"] * bounds["max"]
            for crit_id, bounds in criteria.items()
            if int(crit_id) in weights
        )
        
        current_span = max_score - min_score

        # Calculate how much of the total span each criterion is responsible for.
        #
        # If decision makers agreed on a criterion (i.e. it were fixed to any
        # single value instead of ranging between its min/max bounds), that
        # criterion's own contribution interval [term_min, term_max] would
        # collapse to a point, shrinking the total span by exactly
        # (term_max - term_min) - independent of which value it collapses to,
        # since that fixed value cancels out on both sides of the span.
        criterion_impact = {}
        for crit_id, bounds in criteria.items():
            crit_id_int = int(crit_id)
            if crit_id_int not in weights:
                continue

            w = weights[crit_id_int]
            term_min = w["min"] * bounds["min"]
            term_max = w["max"] * bounds["max"]

            reduction = term_max - term_min
            new_span = current_span - reduction

            criterion_impact[crit_id_int] = {
                "span_before": current_span,
                "span_after": new_span,
                "reduction": reduction
            }
        
        sorted_impact = dict(sorted(criterion_impact.items(), key=lambda x: x[1]["reduction"], reverse=True))
        
        results[alt_id] = {
            "min_score": min_score,
            "max_score": max_score,
            "span": current_span,
            "criterion_impact": sorted_impact
        }
        
    return results