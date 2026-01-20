# Intent Segmentation v2 — Full Context and Deep Technical Summary

This document is a **complete, detailed context transfer** for the intent segmentation rewrite and all algorithmic changes to date. It is intended for a new Cursor chat to fully understand the system, the motivations, the exact implementation details, and the current state of the codebase without needing the original conversation.

---

## 0) Executive Summary (What This System Does)

The intent segmentation system analyzes gameplay clips and assigns a **phase label** over time:

- **Explore** — information gathering, scanning
- **Pursue** — goal-oriented movement toward a target
- **Execute** — decisive action (combat, interaction, timing)
- **Outcome** — resolution / post-action processing

The frontend timeline renders **segments** produced by the backend:

```json
{ "start": ..., "end": ..., "phase": "...", "why": "..." }
```

Every change to backend segmentation **directly affects the intent timeline** after re-running analysis.

---

## 1) High-Level Architecture and Flow

### Backend pipeline (current)
1. Extract frames (FFmpeg)  
2. Compute motion signal (per frame diff)  
3. Compute interaction + entropy (per frame)  
4. Smooth motion + interaction + entropy  
5. Run DP/Viterbi segmentation  
6. Apply stability guardrails (merge, flicker collapse, ordering)  
7. Emit segments with `why` explanations  
8. Store results in job JSON  

### Frontend timeline
The timeline uses:

```
job.result.segments
```

Segments are rendered into phase bars. Any algorithm change requires **re-running the backend analysis**.

---

## 2) Core Files and What They Do

### Backend
**`backend/app/services/intent_segmentation.py`**
- Contains the full DP/Viterbi segmentation logic
- Adaptive per-clip thresholds
- Emission scoring
- Transition penalties
- Segment construction
- Post-processing/stability
- `why` string generation
- Granularity presets

**`backend/app/services/motion_utils.py`**
- Computes motion values, interaction, entropy
- Returns 4 arrays: `times, motion, interaction, entropy`

**`backend/app/workers/tasks.py`**
- Calls `compute_motion_signal`
- Passes motion + interaction + entropy into `segment_intent_phases`
- Does not persist interaction/entropy into JSON yet

### Frontend
**Intent timeline**
Uses backend segments, no inference happens in frontend.

---

## 3) Current Algorithm (Deep Detail)

### 3.1 Adaptive Thresholds
Thresholds are computed per-clip based on motion distribution:

- `low = max(p30, 0.18)`
- `pursue = max(p55, low + 0.06)`
- `spike = max(p90, pursue + 0.08, 0.32)`

Fallback if clip is flat (`p90 - p30 < 0.08` or too short):

- `low = 0.22, pursue = 0.30, spike = 0.40`

**File**: `intent_segmentation.py`  
Function: `_compute_clip_thresholds`

---

### 3.2 Rolling Mean Smoothing
Motion (and optional interaction/entropy) are smoothed using a rolling mean:

```python
ROLLING_WINDOW = preset["rolling_window"]
```

This reduces jitter before segmentation.

---

### 3.3 Emission Scoring
Each phase receives a score per timestep, based on motion + optional interaction/entropy:

#### Motion-based core (dominant)
- **Explore**: best when `m < low`, ok when `low <= m < pursue`
- **Pursue**: best when `pursue <= m < spike`
- **Execute**: very high reward when `m >= spike`, penalty otherwise
- **Outcome**: rewards if following Execute and `m < low`

#### Interaction + entropy modifiers (optional)
If interaction/entropy are passed in:

- Explore is boosted by **high entropy** and **low interaction**
- Pursue boosted by **mid interaction**
- Execute boosted by **high interaction**; penalized by **high entropy or diffuse motion**
- Outcome boosted when motion + entropy collapse

These modifiers are **smaller than motion weights**, so motion still dominates.

---

### 3.4 Transition Penalties
Transitions have penalties to discourage unstable or illegal jumps:

Cheap/normal:
- Explore → Pursue
- Pursue → Execute
- Execute → Outcome
- Outcome → Explore

Discouraged:
- Explore → Execute
- Pursue → Outcome
- Outcome → Pursue

Very discouraged:
- Explore → Outcome
- Execute → Explore
- Outcome → Execute

Penalties can be scaled by granularity presets.

---

### 3.5 Dynamic Programming / Viterbi
Global optimization chooses the **best phase sequence**:

```
dp[i][curr] = max_prev(
    dp[i-1][prev] + emission(curr) - transition_penalty(prev→curr)
)
```

Backtracking gives the final per-frame phase sequence.

---

### 3.6 Segment Construction
Consecutive frames with the same phase are merged into segments:

```json
{ "start": times[start_idx], "end": times[end_idx], "phase": ..., "why": "" }
```

---

### 3.7 Stability Guardrails
After raw segments are built, the system applies multiple stabilization passes:

#### A) Merge short segments (until stable)
Each phase has a minimum duration. If a segment is shorter, it is merged into a neighbor.

Current minimums (default, “normal” preset):
- Explore ≥ 1.6s
- Pursue ≥ 1.0s
- Execute ≥ 0.5s
- Outcome ≥ 0.7s

Merges run repeatedly until no changes remain.

#### B) Flicker collapse (A → B → A)
If a short middle segment occurs between identical phases:

```
Explore → Execute → Explore (Execute < threshold)
```

then the middle segment is collapsed.

Threshold is **preset‑dependent** (normal ≈ 0.6s).

#### C) Outcome sanity
If **no Execute** exists in the final list, Outcome is converted to Explore.  
Outcome implies “post‑execution,” so it is invalid without Execute.

#### D) Full coverage enforcement
- Ensure first segment starts at `times[0]`
- Ensure last segment ends at `times[-1]`
- Clamp gaps between segments

---

### 3.8 “Why” Strings
After stability cleanup, each segment receives a final explanation:

Explore:
```
Mostly calm movement (avg motion X), below the clip's low baseline.
```
Pursue:
```
Sustained active movement (avg motion X) without a spike.
```
Execute:
```
A clear burst of motion (peak X) above the clip's spike level.
```
Outcome:
```
Movement drops right after a burst, suggesting resolution/cooldown.
```

Any merge/flicker/clamp modifications append extra notes.

---

## 4) Interaction + Entropy Signals

### Interaction (motion concentration)
- Frame diff is divided into a **4×4 grid**
- Mean motion per cell is computed
- Interaction is:

```
std(cell_means) / (mean(cell_means) + 1e-6)
```

High interaction = motion concentrated in one area (e.g., combat focus)  
Low interaction = diffuse motion (camera shake, chaos)

### Entropy (visual chaos)
- 32‑bin luminance histogram
- Shannon entropy, normalized by log2(32)

High entropy = visually noisy / chaotic  
Low entropy = calm / stable frame

Both interaction and entropy are normalized to [0,1].

**File**: `motion_utils.py`

---

## 5) Granularity Presets

Segmentation granularity can be tuned via:

```
INTENT_GRANULARITY=coarse|normal|fine
```

### Preset values
**Coarse**
- rolling_window: 7
- min_explore_s: 2.2
- min_pursue_s: 1.4
- min_execute_s: 0.6
- min_outcome_s: 0.9
- flicker_s: 0.9
- penalty_scale: 1.2

**Normal**
- rolling_window: 5
- min_explore_s: 1.6
- min_pursue_s: 1.0
- min_execute_s: 0.5
- min_outcome_s: 0.7
- flicker_s: 0.6
- penalty_scale: 1.0

**Fine**
- rolling_window: 3
- min_explore_s: 1.0
- min_pursue_s: 0.8
- min_execute_s: 0.4
- min_outcome_s: 0.5
- flicker_s: 0.4
- penalty_scale: 0.8

Preset controls how granular phases are without changing public APIs.

---

## 6) Tests Added (Backend)

### Primary segmentation tests
- `backend/app/tests/test_intent_segmentation.py`
- general invariants

### Stability tests
- `test_intent_segmentation_stability.py`
- no flicker, legal ordering, outcome requires execute

### Adaptive threshold tests
- `test_intent_segmentation_thresholds.py`
- thresholds scale with amplitude, no execute for flat signals

### DP tests
- `test_intent_segmentation_dp.py`
- execute appears on spikes, pursue appears on mid motion

### Multisignal tests
- `test_intent_segmentation_multisignal.py`
- interaction/entropy influence execute/pursue/outcome

### Granularity tests
- `test_intent_segmentation_granularity.py`
- fine produces more segments than coarse

### Motion utils test
- `test_motion_utils.py`
- updated to expect interaction + entropy outputs

All tests currently passing after latest changes.

---

## 7) Frontend Timeline Changes (Context)

Frontend timeline renders segments directly and scales by video duration.
Key points:
- If you don’t re-run analysis, old segmentation persists.
- Timeline uses `job.result.segments` to render phase bars.

---

## 8) Labeling Guidelines (Phase 0 for ML Rewrite)

Labeling guidelines are already defined (provided by user).
Summary:
- Explore = scanning / info gathering
- Pursue = directional intent
- Execute = decisive action
- Outcome = resolution / processing

Minimum duration rules:
- Explore ≥ 2.0s
- Pursue ≥ 1.2s
- Execute ≥ 0.5s
- Outcome ≥ 0.8s
- Collapse A→B→A flicker if B < 0.8s

Allowed transitions:
- Explore → Pursue
- Pursue → Execute
- Execute → Outcome
- Outcome → Explore
- Explore → Execute (reactive)
- Outcome → Pursue (chaining)

---

## 9) Labeling Format (Option A)

```json
{
  "clip_id": "clip_001",
  "fps": 10,
  "duration_s": 42.3,
  "segments": [
    { "start": 0.0, "end": 3.1, "phase": "Explore" },
    { "start": 3.1, "end": 6.4, "phase": "Pursue" },
    { "start": 6.4, "end": 9.8, "phase": "Execute" },
    { "start": 9.8, "end": 12.5, "phase": "Outcome" }
  ]
}
```

Clips should be ~30–90s ideally.

---

## 10) Large Rewrite Roadmap (ML‑based)

### Phase 0: Labels
- Provide 20–50 labeled clips (Option A format)
- Provide labeling guidelines (done)
- Provide a validation script for labels

### Phase 1: Feature pipeline
- Motion, interaction, entropy
- Audio energy + spectral flux
- Scene change detection

### Phase 2: Dataset builder
- Align features with labels
- Save as Parquet/NPZ

### Phase 3: Baseline model
- XGBoost/LightGBM classifier
- Output per‑frame phase probabilities

### Phase 4: Temporal smoothing
- Viterbi or CRF applied to logits

### Phase 5: Backend integration
- Replace segmentation with model inference
- Generate reasons from feature importance

### Phase 6: Feedback loop
- UI correction tool
- Retraining on user feedback

---

## 11) Environment Notes

To see changes in production:
- Redeploy **Railway backend**
- Redeploy **Vercel frontend** only if frontend changed
- Re-run analysis to regenerate job JSON

---

## 12) Key Message for New Chat

This system has moved from a heuristic approach to a **DP/Viterbi segmentation core** with adaptive thresholds, interaction/entropy features, and stability guardrails. The current state is robust but still heuristic‑driven. A true production‑grade rewrite requires labeled data and a learned model.
