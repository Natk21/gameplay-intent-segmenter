from typing import List, Dict


def compute_intent_insights(segments: List[Dict]) -> Dict:
    if not segments or len(segments) < 2:
        return {
            "headline": "Insufficient data to infer intent structure.",
            "volatility": {"label": "Low", "score": 0.0},
            "transitions": 0,
            "avg_segment_s": 0.0,
        }

    total_duration = segments[-1]["end"]
    transitions = len(segments) - 1
    avg_segment = total_duration / len(segments)

    volatility_score = transitions / max(total_duration, 1.0)

    if volatility_score < 0.05:
        label = "Low"
    elif volatility_score < 0.15:
        label = "Medium"
    else:
        label = "High"

    # Headline logic (simple but expressive)
    phases = [s["phase"] for s in segments]
    explore_ratio = phases.count("Explore") / len(phases)
    execute_ratio = phases.count("Execute") / len(phases)

    if volatility_score > 0.15:
        headline = "Rapid intent switching suggests opportunistic play."
    elif execute_ratio < 0.2:
        headline = "Gameplay dominated by exploration with infrequent execution."
    else:
        headline = "Structured gameplay with clear execution phases."

    return {
        "headline": headline,
        "volatility": {"label": label, "score": round(volatility_score, 3)},
        "transitions": transitions,
        "avg_segment_s": round(avg_segment, 2),
    }

def derive_transitions(segments):
    transitions = []

    for i in range(1, len(segments)):
        prev = segments[i - 1]
        curr = segments[i]

        t = curr["start"]

        hesitation = (
            prev["phase"] == curr["phase"] or
            abs(prev["confidence"] - curr["confidence"]) < 0.15
        )

        transitions.append({
            "id": f"{i}",
            "time": t,
            "from_phase": prev["phase"],
            "to_phase": curr["phase"],
            "hesitation": hesitation,
            "confidence": min(prev["confidence"], curr["confidence"]),
            "why": (
                "Phase boundary with unstable confidence"
                if hesitation
                else "Clear phase transition"
            ),
        })

    return transitions
