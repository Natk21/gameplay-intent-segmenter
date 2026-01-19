import { render, screen } from "@testing-library/react";
import Home from "./page";

describe("Landing hero", () => {
  it("renders the CTA headline and supporting subtitle", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        name: /find the moments that change everything/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /upload a clip and we split it into phases, flag key decision moments/i
      )
    ).toBeInTheDocument();
  });

  it("links the primary CTA to the app", () => {
    render(<Home />);

    const ctas = screen.getAllByRole("link", { name: /analyze a clip/i });
    const appCta = ctas.find((link) => link.getAttribute("href") === "/app");
    expect(appCta).toBeTruthy();
  });

  it("includes a how-it-works anchor below the hero", () => {
    render(<Home />);

    const anchor = document.querySelector("#how-it-works");
    expect(anchor).toBeTruthy();
  });

  it("centers the hero content", () => {
    render(<Home />);

    const headline = screen.getByRole("heading", {
      name: /find the moments that change everything/i,
    });
    const centeredContainer = headline.closest(".text-center");
    expect(centeredContainer).toBeTruthy();
  });

  it("does not show the example analysis card", () => {
    render(<Home />);

    expect(
      screen.queryByRole("heading", { name: /example analysis/i })
    ).not.toBeInTheDocument();
  });
});

describe("How it works section", () => {
  it("renders the section heading and step copy", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /how it works/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /upload a clip/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /upload a gameplay recording to start an automatic analysis\. no setup required\./i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /see how intent changes over time/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /we break the clip into phases like exploring, executing, and resolving so you can see how the session unfolds\./i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /spot key decision moments/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /we flag moments where behavior shifts — hesitation, commitment, or sudden changes in direction\./i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /understand why those moments happened/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /dive into the underlying signals to see what evidence led the system to each conclusion\./i
      )
    ).toBeInTheDocument();
  });

  it("wires motion previews for each step", () => {
    render(<Home />);

    expect(
      screen.getByLabelText("Uploading a gameplay clip for analysis")
    ).toHaveAttribute("src", "/previews/upload.mp4");
    expect(
      screen.getByLabelText(
        "Intent timeline showing explore, execute, and outcome phases"
      )
    ).toHaveAttribute("src", "/previews/phases.mp4");
    expect(
      screen.getByLabelText("Decision moments being highlighted in the timeline")
    ).toHaveAttribute("src", "/previews/decision-moments.mp4");
    expect(
      screen.getByLabelText(
        "Signal analysis chart explaining why intent changes were detected"
      )
    ).toHaveAttribute("src", "/previews/signal-analysis.mp4");
  });
});

describe("What you'll see section", () => {
  it("renders the heading, cards, and CTA", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { name: /what the analysis actually shows/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /not just what happened in the clip — but when intent changed, why it changed, and how confident the system is\./i
      )
    ).toBeInTheDocument();
    expect(screen.getByText(/clear intent phases/i)).toBeInTheDocument();
    expect(screen.getByText(/key decision points/i)).toBeInTheDocument();
    expect(screen.getByText(/evidence, not guesses/i)).toBeInTheDocument();
    expect(screen.getByAltText("Intent timeline preview")).toHaveAttribute(
      "src",
      "/previews/phases.png"
    );
    expect(screen.getByAltText("Decision moment example")).toHaveAttribute(
      "src",
      "/previews/decision-moments.png"
    );
    expect(screen.getByAltText("Signal analysis view")).toHaveAttribute(
      "src",
      "/previews/signal-analysis.png"
    );

    const ctas = screen.getAllByRole("link", { name: /analyze a clip/i });
    const sectionCta = ctas.find(
      (link) => link.getAttribute("href") === "#features"
    );
    expect(sectionCta).toBeTruthy();
  });
});
