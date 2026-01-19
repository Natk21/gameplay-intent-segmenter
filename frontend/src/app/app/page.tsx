"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { UploadCloud, Film } from "lucide-react";
import { IntentTimeline } from "@/components/timeline/IntentTimeline";
import { SegmentList } from "@/components/segments/SegmentList";
import { SegmentDetails } from "@/components/segments/SegmentDetails";
import { PhaseDistribution } from "@/components/metrics/PhaseDistribution";
import { InsightSummaryCard } from "@/components/metrics/InsightSummaryCard";
import { TransitionList } from "@/components/transitions/TransitionList";
import { SignalAnalysisPanel } from "@/components/signal/SignalAnalysisPanel";
import { ResultsSplitLayout } from "@/components/ResultsSplitLayout";
import { getSeekTime } from "@/utils/seek";
import {
  consolidateDecisionMoments,
  DEBUG_CONSOLIDATION,
  getConsolidationSummary,
  logConsolidationSummary,
  type ConsolidatedDecisionMoment,
} from "@/utils/consolidateDecisionMoments";
import { applyLearnedConfidence } from "@/utils/applyLearnedConfidence";
import { applyLearnedSegmentConfidence } from "@/utils/applyLearnedSegmentConfidence";
import { getPhaseAtTime } from "@/utils/phaseLookup";
import {
  addClipToGlobalStats,
  type ClipSummary,
} from "@/utils/globalBaselineStats";

type Transition = {
  id: string;
  time: number;
  from_phase: string;
  to_phase: string;
  confidence: number;
  change_type: "commitment" | "resolution" | "shift" | "hesitation";
  explanation: string;
  hesitation?: boolean;
  start_time?: number;
  end_time?: number;
  duration?: number;
  transition_count?: number;
  confidence_level?: "low" | "medium" | "high";
  confidence_score?: number;
  confidence_reason?: string;
  signal_intensity?: number;
  within_clip_percentile?: number;
  comparative_label?: "normal" | "elevated" | "extreme";
};

type JobStatus = {
  job_id: string;
  status: string;
  progress: number;
  message: string;
  result: any | null;
};

export default function AppPage() {
  const [file, setFile] = useState<File | null>(null);
  const [job, setJob] = useState<JobStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastPhase, setLastPhase] = useState<string | null>(null);
  const [flash, setFlash] = useState(false);
  const [pendingSeekTime, setPendingSeekTime] = useState<number | null>(
    null
  );
  const [hoveredSegmentIndex, setHoveredSegmentIndex] =
    useState<number | null>(null);
  const [showResults, setShowResults] = useState(false);

  // NEW: selected transition
  const [activeTransition, setActiveTransition] =
    useState<Transition | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const loggedJobIdRef = useRef<string | null>(null);
  const loggedPhaseJobIdRef = useRef<string | null>(null);
  const loggedGlobalStatsJobIdRef = useRef<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);
  const apiBase = useMemo(() => {
    const base =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    return base.replace(/\/$/, "");
  }, []);
  function getActiveSegment(segments: any[], t: number) {
    return segments.find(
      (s) => t >= s.start && t < s.end
    );
  }
  useEffect(() => {
    if (!job?.result) return;
  
    const seg = getActiveSegment(job.result.segments, currentTime);
    if (!seg) return;
  
    if (seg.phase !== lastPhase) {
      setFlash(true);
      setLastPhase(seg.phase);
      setTimeout(() => setFlash(false), 200);
    }
  }, [currentTime, job?.result]);

  useEffect(() => {
    if (!job?.result) {
      setShowResults(false);
      return;
    }

    setShowResults(false);
    const animationFrame = requestAnimationFrame(() => {
      setShowResults(true);
    });
    return () => cancelAnimationFrame(animationFrame);
  }, [job?.result]);

  useEffect(() => {
    setVideoDuration(null);
  }, [job?.result?.video?.url]);

  // -----------------------------
  // Upload + run analysis
  // -----------------------------
  async function runAnalysis() {
    if (!file) return;

    setLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${apiBase}/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Upload failed: ${res.status}`);
      }

      const data = await res.json();
      pollJob(data.job_id);
    } catch (error) {
      setLoading(false);
      setJob({
        job_id: "",
        status: "error",
        progress: 0,
        message:
          error instanceof Error
            ? error.message
            : "Upload failed. Is the backend running?",
        result: null,
      });
    }
  }

  // -----------------------------
  // Poll job status
  // -----------------------------
  async function pollJob(jobId: string) {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${apiBase}/api/job/${jobId}`);
        if (!res.ok) {
          throw new Error(`Job fetch failed: ${res.status}`);
        }
        const data = await res.json();
        setJob(data);

        if (data.status === "done") {
          clearInterval(interval);
          setLoading(false);
        }
      } catch (error) {
        clearInterval(interval);
        setLoading(false);
        setJob({
          job_id: jobId,
          status: "error",
          progress: 0,
          message:
            error instanceof Error
              ? error.message
              : "Failed to reach backend. Is it running?",
          result: null,
        });
      }
    }, 800);
  }

  // -----------------------------
  // Render
  // -----------------------------
  console.log("JOB RESULT:", job?.result);

  const rawSegments = job?.result?.segments ?? [];
  const videoUrl = useMemo(() => {
    const url = job?.result?.video?.url;
    if (!url) return null;
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url;
    }
    return `${apiBase}${url}`;
  }, [apiBase, job?.result?.video?.url]);
  const segments = useMemo(() => {
    if (!rawSegments.length) return rawSegments;
    return applyLearnedSegmentConfidence(
      rawSegments,
      (job?.result?.transitions ?? []) as { time: number }[],
      job?.result?.signals?.t ?? [],
      job?.result?.signals?.motion_smooth ?? []
    );
  }, [
    rawSegments,
    job?.result?.transitions,
    job?.result?.signals?.t,
    job?.result?.signals?.motion_smooth,
  ]);
  const activeSegment = segments.length
    ? getActiveSegment(segments, currentTime)
    : null;
  const hoveredSegment =
    hoveredSegmentIndex !== null &&
    hoveredSegmentIndex >= 0 &&
    hoveredSegmentIndex < segments.length
      ? segments[hoveredSegmentIndex]
      : null;
  const segmentMaxEnd = segments.length
    ? Math.max(
        ...segments.map(
          (segment: { end: number }) => segment.end
        )
      )
    : null;
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const videoDuration = job?.result?.video?.duration_s;
    if (!Number.isFinite(videoDuration) || !Number.isFinite(segmentMaxEnd)) {
      return;
    }
    const diff = Math.abs(
      (segmentMaxEnd as number) - (videoDuration as number)
    );
    if (diff > 2) {
      console.warn(
        "[timeline] segment end vs video duration mismatch",
        {
          segmentMaxEnd,
          videoDuration,
        }
      );
    }
  }, [job?.result?.video?.duration_s, segmentMaxEnd]);
  const phaseDistribution =
    job?.result?.summary?.phase_distribution ?? {};
  const primaryPhaseData = Object.entries(phaseDistribution).reduce(
    (acc, [phase, value]) => {
      if (typeof value !== "number") return acc;
      if (value > acc.value) return { phase, value };
      return acc;
    },
    { phase: "Explore", value: -1 }
  );
  const primaryPhase =
    primaryPhaseData.value >= 0
      ? primaryPhaseData.phase
      : "Explore";
  const primaryPhasePercent =
    primaryPhaseData.value >= 0
      ? primaryPhaseData.value * 100
      : 0;
  const transitionCount =
    job?.result?.metrics?.transitions_count ?? 0;
  const segmentCount =
    job?.result?.metrics?.segments_count ?? segments.length;
  const timelineDuration = Number.isFinite(videoDuration)
    ? (videoDuration as number)
    : Number.isFinite(job?.result?.video?.duration_s)
    ? (job?.result?.video?.duration_s as number)
    : 0;
  const clipDurationSeconds = (() => {
    const videoDuration = job?.result?.video?.duration_s;
    if (Number.isFinite(videoDuration)) return videoDuration as number;
    return 0;
  })();
  const consolidatedTransitions = useMemo<Transition[]>(() => {
    const transitions = (job?.result?.transitions ?? []) as Transition[];
    const segments = job?.result?.segments ?? [];
    const times = job?.result?.signals?.t ?? [];
    const motion = job?.result?.signals?.motion_smooth ?? [];
    const moments = consolidateDecisionMoments(
      transitions,
      times,
      motion
    ) as Array<Transition & ConsolidatedDecisionMoment>;
    const phaseContexts = moments.map((moment) => {
      if (moment.change_type === "hesitation" || moment.hesitation) {
        return "hesitate";
      }
      const lookupTime = moment.time ?? moment.start_time ?? 0;
      const phase = getPhaseAtTime(segments, lookupTime);
      if (phase === "Explore") return "explore";
      if (phase === "Execute") return "execute";
      return "unknown";
    });
    const { moments: learnedMoments } = applyLearnedConfidence(
      moments,
      times,
      motion,
      phaseContexts
    );
    return learnedMoments as Transition[];
  }, [
    job?.result?.transitions,
    job?.result?.signals?.t,
    job?.result?.signals?.motion_smooth,
    job?.result?.segments,
  ]);

  function getConfidenceLevel(transition: Transition) {
    return transition.confidence_level ?? "medium";
  }

  function getConfidenceMarkerClass(transition: Transition) {
    const level = getConfidenceLevel(transition);
    if (level === "high") return "opacity-100";
    if (level === "medium") return "opacity-80";
    return "opacity-60";
  }

  useEffect(() => {
    if (!DEBUG_CONSOLIDATION) return;
    if (!job?.job_id || !job?.result?.transitions) return;
    if (loggedJobIdRef.current === job.job_id) return;
    loggedJobIdRef.current = job.job_id;
    const summary = getConsolidationSummary(
      job.result.transitions as Transition[],
      consolidatedTransitions as Transition[]
    );
    logConsolidationSummary(summary);
  }, [job?.job_id, job?.result?.transitions, consolidatedTransitions]);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (!job?.job_id || !job?.result?.transitions) return;
    if (loggedPhaseJobIdRef.current === job.job_id) return;
    loggedPhaseJobIdRef.current = job.job_id;
    const transitions = (job?.result?.transitions ?? []) as Transition[];
    const segments = job?.result?.segments ?? [];
    const times = job?.result?.signals?.t ?? [];
    const motion = job?.result?.signals?.motion_smooth ?? [];
    const moments = consolidateDecisionMoments(
      transitions,
      times,
      motion
    ) as Array<Transition & ConsolidatedDecisionMoment>;
    const phaseContexts = moments.map((moment) => {
      if (moment.change_type === "hesitation" || moment.hesitation) {
        return "hesitate";
      }
      const lookupTime = moment.time ?? moment.start_time ?? 0;
      const phase = getPhaseAtTime(segments, lookupTime);
      if (phase === "Explore") return "explore";
      if (phase === "Execute") return "execute";
      return "unknown";
    });
    const { diagnostics } = applyLearnedConfidence(
      moments,
      times,
      motion,
      phaseContexts
    );
    if (!diagnostics) return;
    console.debug("[confidence] trained phase models", {
      explore: diagnostics.sampleCounts.explore,
      execute: diagnostics.sampleCounts.execute,
      hesitate: diagnostics.sampleCounts.hesitate,
    });
    console.debug("[confidence] phase confidence distribution", {
      explore: diagnostics.confidenceStats.explore,
      execute: diagnostics.confidenceStats.execute,
      hesitate: diagnostics.confidenceStats.hesitate,
    });
  }, [job?.job_id, job?.result?.transitions, job?.result?.segments, job?.result?.signals]);

  useEffect(() => {
    if (!job?.job_id || !job?.result?.transitions) return;
    if (loggedGlobalStatsJobIdRef.current === job.job_id) return;
    loggedGlobalStatsJobIdRef.current = job.job_id;
    const transitions = (job?.result?.transitions ?? []) as Transition[];
    const times = job?.result?.signals?.t ?? [];
    const motion = job?.result?.signals?.motion_smooth ?? [];
    const moments = consolidateDecisionMoments(
      transitions,
      times,
      motion
    ) as Array<Transition & ConsolidatedDecisionMoment>;
    const clipDurationSeconds = Number.isFinite(
      job?.result?.video?.duration_s
    )
      ? (job?.result?.video?.duration_s as number)
      : times.length >= 2
      ? Math.max(...times) - Math.min(...times)
      : 0;
    const clipVolatilityScore =
      clipDurationSeconds > 0
        ? transitions.length / clipDurationSeconds
        : 0;
    const hesitationMoments = moments
      .filter(
        (moment) =>
          moment.hesitation ||
          moment.change_type === "hesitation"
      )
      .map((moment) => ({
        duration: moment.duration ?? 0,
        transition_count: moment.transition_count ?? 0,
        intensity: moment.signal_intensity ?? 0,
      }));
    const summary: ClipSummary = {
      clipVolatilityScore,
      hesitationMoments,
    };
    addClipToGlobalStats(summary);
  }, [job?.job_id, job?.result?.transitions, job?.result?.signals]);

  function seekVideoTo(startTime: number) {
    const seekTime = getSeekTime(
      startTime,
      videoRef.current?.duration ??
        videoDuration ??
        job?.result?.video?.duration_s,
      segmentMaxEnd
    );
    if (seekTime === null) return;

    if (videoRef.current && videoRef.current.readyState >= 1) {
      videoRef.current.currentTime = seekTime;
      videoRef.current.pause();
      setCurrentTime(seekTime);
      return;
    }

    setPendingSeekTime(seekTime);
    setCurrentTime(seekTime);
  }

  function getTransitionLabel(transition: Transition) {
    const typeLabel =
      transition.change_type === "commitment"
        ? "Commitment"
        : transition.change_type === "resolution"
        ? "Resolution"
        : transition.change_type === "hesitation"
        ? "Hesitation"
        : "Shift";
    if (transition.hesitation && transition.change_type !== "hesitation") {
      return `Hesitation · ${typeLabel}`;
    }
    return typeLabel;
  }

  function formatFileSize(bytes: number) {
    if (!Number.isFinite(bytes)) return "—";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    const kb = bytes / 1024;
    return `${kb.toFixed(0)} KB`;
  }

  const progressRatio = Math.min(
    Math.max(job?.progress ?? 0, 0),
    1
  );
  const progressPercent = Math.round(progressRatio * 100);
  const isProcessing =
    loading ||
    (!!job && job.status !== "done" && job.status !== "error");

  return (
    <main className="w-full max-w-7xl mx-auto p-8 space-y-8">
      {/* Upload */}
      <div className="w-full max-w-2xl mx-auto border rounded p-6 space-y-4">
        <label
          className={`block rounded border-2 border-dashed p-6 text-center cursor-pointer transition
            ${
              file
                ? "border-emerald-500/70 bg-emerald-500/5"
                : "border-muted-foreground/30 hover:border-muted-foreground/60"
            }`}
        >
          <input
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
          {!file ? (
            <div className="space-y-2">
              <div className="mx-auto h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-xl">
                <UploadCloud className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-base font-medium">
                Drag & drop gameplay clip
              </div>
              <div className="text-xs text-muted-foreground">
                MP4, WebM, MOV · Max 500MB
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="mx-auto h-12 w-12 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-xl">
                <Film className="h-6 w-6" />
              </div>
              <div className="text-base font-medium">
                {file.name}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </div>
            </div>
          )}
        </label>

        <button
          onClick={runAnalysis}
          disabled={!file || loading}
          className="w-full px-4 py-3 rounded bg-blue-600 text-white disabled:opacity-50"
        >
          {job?.result ? "Re-run Segmentation" : "Run Intent Segmentation"}
        </button>

        {isProcessing && (
          <div className="rounded-lg border bg-card/40 p-4 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <div className="font-medium text-foreground">
                Extracting Frames
              </div>
              <div className="text-muted-foreground">
                {progressPercent}%
              </div>
            </div>
            <div className="relative h-3 overflow-hidden rounded-full bg-muted/60">
              <div className="absolute inset-0 processing-shimmer opacity-60" />
              <div
                className="h-full rounded-full bg-blue-500 transition-[width] duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
              <div
                className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-blue-200 shadow-[0_0_12px_rgba(59,130,246,0.9)] transition-[left] duration-500 ease-out"
                style={{
                  left: `calc(${progressPercent}% - 8px)`,
                }}
              />
            </div>
            <div className="flex flex-col items-center gap-2 pt-2">
              <div className="relative h-20 w-20">
                <div className="absolute inset-0 rounded-full border border-border/40" />
                <div
                  className="absolute inset-0 processing-ring spin-slow"
                  style={{
                    background: `conic-gradient(from 90deg, rgba(59,130,246,0.95) 0deg, rgba(59,130,246,0.95) ${
                      progressRatio * 360
                    }deg, rgba(59,130,246,0.15) ${
                      progressRatio * 360
                    }deg, rgba(59,130,246,0.15) 360deg)`,
                  }}
                />
                <div className="absolute inset-3 rounded-full bg-background/80" />
              </div>
              <div className="text-xs text-muted-foreground">
                {job?.message ?? "Processing video..."}
              </div>
            </div>
          </div>
        )}
        {job?.status === "error" && (
          <div className="rounded border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {job.message}
          </div>
        )}
      </div>

      {/* Results */}
      {job?.result && (
        <div
          className={`transition-all duration-700 ease-out ${
            showResults ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
          }`}
        >
          <InsightSummaryCard
            primaryPhase={primaryPhase}
            phasePercent={primaryPhasePercent}
            transitions={transitionCount}
            segments={segmentCount}
            clipDurationSeconds={clipDurationSeconds}
            segmentsData={job?.result?.segments ?? undefined}
          />
          <div className="mb-6">
            <ResultsSplitLayout
              video={
                <div className="relative rounded border overflow-hidden">
                  <video
                    ref={videoRef}
                    src={videoUrl ?? undefined}
                    controls
                    className="w-full"
                    onLoadedMetadata={() => {
                      if (videoRef.current) {
                        const duration = videoRef.current.duration;
                        if (Number.isFinite(duration)) {
                          setVideoDuration(duration);
                        }
                      }
                      if (pendingSeekTime === null) return;
                      if (videoRef.current) {
                        videoRef.current.currentTime =
                          pendingSeekTime;
                        videoRef.current.pause();
                      }
                      setCurrentTime(pendingSeekTime);
                      setPendingSeekTime(null);
                    }}
                    onTimeUpdate={() => {
                      if (videoRef.current) {
                        setCurrentTime(
                          videoRef.current.currentTime
                        );
                      }
                    }}
                  />

                  {/* Intent overlay */}
                  {activeSegment && (
                    <div
                      className={`absolute top-3 left-3 px-3 py-1 rounded text-sm transition-all
                        ${
                          flash
                            ? "bg-yellow-500 text-black scale-105"
                            : "bg-black/70 text-white"
                        }
                      `}
                    >
                      <div className="font-medium">
                        {activeSegment.phase}
                      </div>
                      <div className="opacity-80">
                        {(
                          activeSegment.confidence * 100
                        ).toFixed(0)}
                        % confidence
                      </div>
                    </div>
                  )}
                </div>
              }
              summary={
                <PhaseDistribution
                  segments={job.result.segments}
                  metrics={job.result.metrics}
                  exportData={job.result}
                />
              }
            />
          </div>

          {/* Intent timeline + transitions */}
          <div className="relative">
            <IntentTimeline
              segments={job.result.segments}
              duration={timelineDuration}
              currentTime={currentTime}
              onSelectSegment={seekVideoTo}
              onHoverSegment={setHoveredSegmentIndex}
            />
          </div>

          <SegmentDetails segment={hoveredSegment ?? activeSegment} />

          <TransitionList
            transitions={consolidatedTransitions as Transition[]}
            activeTransitionId={activeTransition?.id ?? null}
            selectedTransition={activeTransition}
            signalTimes={job.result.signals?.t ?? []}
            motionSignal={job.result.signals?.motion_smooth ?? []}
            onSelect={(transition) => {
              setActiveTransition(transition);
              seekVideoTo(transition.time);
            }}
          />

          <SegmentList
            segments={job.result.segments}
            activeSegmentId={activeSegment?.id ?? null}
            onSelect={seekVideoTo}
          />

          <SignalAnalysisPanel
            times={job.result.signals?.t ?? []}
            motion={job.result.signals?.motion_smooth ?? []}
            onSeek={seekVideoTo}
            segments={job.result.segments ?? []}
            decisionMoments={job.result.decision_moments ?? []}
          />
        </div>
      )}
    </main>
  );
}
