import { render, screen } from "@testing-library/react";
import MotionPreview from "./MotionPreview";

const mockMatchMedia = (matches: boolean) => {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? matches : false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
};

describe("MotionPreview", () => {
  it("renders a poster image when reduced motion is preferred", () => {
    mockMatchMedia(true);

    render(
      <MotionPreview
        src="/previews/intent-timeline.mp4"
        poster="/previews/intent-timeline.png"
        alt="Intent timeline preview"
      />
    );

    const image = screen.getByLabelText("Intent timeline preview");
    expect(image.tagName.toLowerCase()).toBe("img");
  });

  it("renders a video when reduced motion is not preferred", () => {
    mockMatchMedia(false);

    render(
      <MotionPreview
        src="/previews/intent-timeline.mp4"
        poster="/previews/intent-timeline.png"
        alt="Intent timeline preview"
      />
    );

    const video = screen.getByLabelText("Intent timeline preview");
    expect(video.tagName.toLowerCase()).toBe("video");
    expect(video).toHaveAttribute("preload", "metadata");
  });
});
