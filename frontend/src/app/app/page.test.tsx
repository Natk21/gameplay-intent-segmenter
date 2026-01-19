import { render, screen } from "@testing-library/react";
import AppPage from "./page";

describe("AppPage layout sizing", () => {
  it("uses a wider container to reduce layout squish", () => {
    render(<AppPage />);

    const main = screen.getByRole("main");
    expect(main).toHaveClass("max-w-7xl");
  });
});
