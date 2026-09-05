import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OpponentSilhouette } from "./OpponentSilhouette.tsx";

// One given in the top-left corner, everything else empty.
const PUZZLE = `5${".".repeat(80)}`;

function states(): string[] {
  return [...screen.getByTestId("opponent-silhouette").children].map(
    (el) => el.getAttribute("data-state") ?? "",
  );
}

describe("OpponentSilhouette", () => {
  it("tells the shared givens apart from what the opponent wrote", () => {
    // Both players race the same givens, so a silhouette that tinted
    // them like progress would start every game looking a third done.
    const mask = `11${"0".repeat(79)}`;

    render(<OpponentSilhouette mask={mask} puzzle={PUZZLE} />);

    const cells = states();
    expect(cells).toHaveLength(81);
    expect(cells[0]).toBe("given");
    expect(cells[1]).toBe("filled");
    expect(cells[2]).toBe("empty");
  });

  it("renders an empty grid before the opponent has published anything", () => {
    render(<OpponentSilhouette mask="" puzzle={PUZZLE} />);

    expect(states().filter((s) => s === "filled")).toHaveLength(0);
  });
});
