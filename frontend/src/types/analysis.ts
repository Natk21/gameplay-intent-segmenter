export type IntentPhase = "Explore" | "Pursue" | "Execute" | "Outcome";

export type Segment = {
  id: string;
  start: number;
  end: number;
  phase: IntentPhase;
  confidence: number;
  dominant_signals: string[];
  explanation: string;
};

export type Transition = {
  id: string;
  time: number;
  from_phase: IntentPhase;
  to_phase: IntentPhase;
  confidence: number;
  signal_delta: {
    motion: number | null;
    entropy: number | null;
    interaction: number | null;
  };
  explanation: string;
  from_segment_id: string;
  to_segment_id: string;
};

export type AnalysisResult = {
  video: { path: string; duration_s: number; fps_sampled: number };
  summary: {
    headline: string;
    phase_distribution: Record<IntentPhase, number>;
    avg_segment_s: number;
  };
  metrics: {
    transitions_count: number;
    volatility: { label: "Low" | "Medium" | "High"; score: number };
    segments_count: number;
  };
  segments: Segment[];
  transitions: Transition[];
  signals: {
    t: number[];
    motion: number[];
    entropy: number[];
    interaction: number[];
  };
};
