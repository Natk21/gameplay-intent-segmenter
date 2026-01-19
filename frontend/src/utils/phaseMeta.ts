import { CheckCircle2, Compass, Target, Zap } from "lucide-react";

export const PHASE_META: Record<
  string,
  {
    title: string;
    verb: string;
    sentence: string;
    accent: string;
    glow: string;
    icon: typeof Compass;
  }
> = {
  Explore: {
    title: "High Exploration Behavior Detected",
    verb: "exploring",
    sentence:
      "The player spends most of the clip gathering information and testing options before committing to actions.",
    accent: "bg-blue-500",
    glow: "from-blue-500/20 via-blue-500/10 to-transparent",
    icon: Compass,
  },
  Execute: {
    title: "High Execution Behavior Detected",
    verb: "executing",
    sentence:
      "The player shows frequent bursts of decisive action with short pauses in between.",
    accent: "bg-red-500",
    glow: "from-red-500/20 via-red-500/10 to-transparent",
    icon: Zap,
  },
  Outcome: {
    title: "Outcome-Focused Play Detected",
    verb: "finishing objectives",
    sentence:
      "The player spends most of the clip resolving objectives with minimal switching.",
    accent: "bg-emerald-500",
    glow: "from-emerald-500/20 via-emerald-500/10 to-transparent",
    icon: CheckCircle2,
  },
};

export const FALLBACK_META = {
  title: "Focused Playstyle Detected",
  verb: "playing",
  sentence:
    "The player maintains a consistent behavioral style across the clip.",
  accent: "bg-slate-500",
  glow: "from-slate-500/20 via-slate-500/10 to-transparent",
  icon: Target,
};

export function getPhaseCopy(phase: string) {
  const meta = PHASE_META[phase] ?? FALLBACK_META;
  return {
    title: meta.title,
    sentence: meta.sentence,
  };
}
