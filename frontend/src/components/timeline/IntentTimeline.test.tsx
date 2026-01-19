import { render } from "@testing-library/react";
import { IntentTimeline } from "./IntentTimeline";

describe("IntentTimeline", () => {
  it("clamps segments to the video duration and skips overflow", () => {
    const segments = [
      { start: -2, end: 2, phase: "Explore", why: "test" },
      { start: 5, end: 12, phase: "Execute", why: "test" },
      { start: 15, end: 20, phase: "Outcome", why: "test" },
    ];

    const { getAllByTestId, queryAllByTestId } = render(
      <IntentTimeline segments={segments} duration={10} />
    );

    const renderedSegments = getAllByTestId("intent-segment");
    expect(renderedSegments).toHaveLength(2);
    expect(renderedSegments[0]).toHaveStyle({
      left: "0%",
      width: "20%",
    });
    expect(renderedSegments[1]).toHaveStyle({
      left: "50%",
      width: "50%",
    });

    expect(queryAllByTestId("intent-segment")).toHaveLength(2);
  });

  it("positions the playhead within the clamped duration", () => {
    const segments = [
      { start: 0, end: 10, phase: "Explore", why: "test" },
    ];

    const { getByTestId } = render(
      <IntentTimeline
        segments={segments}
        duration={10}
        currentTime={5}
      />
    );

    expect(getByTestId("intent-playhead")).toHaveStyle({
      left: "50%",
    });
  });
});
