import type { ReactNode } from "react";

type ResultsSplitLayoutProps = {
  video: ReactNode;
  summary: ReactNode;
};

export function ResultsSplitLayout({
  video,
  summary,
}: ResultsSplitLayoutProps) {
  return (
    <div
      data-testid="results-split-layout"
      className="grid gap-6 lg:gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)] lg:items-center"
    >
      {video}
      {summary}
    </div>
  );
}
