import { render, screen } from "@testing-library/react";
import { ResultsSplitLayout } from "./ResultsSplitLayout";

describe("ResultsSplitLayout", () => {
  it("renders a wide, two-column grid layout on desktop", () => {
    render(
      <ResultsSplitLayout
        video={<div data-testid="video-panel">Video</div>}
        summary={<div data-testid="summary-panel">Summary</div>}
      />
    );

    const layout = screen.getByTestId("results-split-layout");
    expect(layout).toHaveClass(
      "grid",
      "gap-6",
      "lg:gap-10",
      "lg:grid-cols-[minmax(0,6fr)_minmax(0,4fr)]",
      "lg:items-center"
    );
  });

  it("keeps video before summary in DOM order", () => {
    render(
      <ResultsSplitLayout
        video={<div data-testid="video-panel">Video</div>}
        summary={<div data-testid="summary-panel">Summary</div>}
      />
    );

    const layout = screen.getByTestId("results-split-layout");
    const [firstChild, secondChild] = Array.from(layout.children);
    expect(firstChild).toHaveAttribute("data-testid", "video-panel");
    expect(secondChild).toHaveAttribute("data-testid", "summary-panel");
  });
});
