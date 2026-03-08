// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { About } from "./About.tsx";

describe("About", () => {
  it("renders the page heading", () => {
    render(<About onBack={() => {}} onPlay={() => {}} />);
    expect(
      screen.getByRole("heading", { name: /dokuel/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it("renders key feature sections", () => {
    render(<About onBack={() => {}} onPlay={() => {}} />);
    expect(
      screen.getByRole("heading", { name: /solo play/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /daily challenge/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /1v1 multiplayer/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /friends/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /mobile/i }),
    ).toBeInTheDocument();
  });

  it("renders call-to-action buttons", () => {
    const onPlay = vi.fn();
    render(<About onBack={() => {}} onPlay={onPlay} />);
    const playBtns = screen.getAllByRole("button", { name: /play now/i });
    expect(playBtns.length).toBeGreaterThanOrEqual(1);
    playBtns[0]!.click();
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it("renders back button", () => {
    const onBack = vi.fn();
    render(<About onBack={onBack} onPlay={() => {}} />);
    const backBtn = screen.getByRole("button", { name: /back/i });
    expect(backBtn).toBeInTheDocument();
    backBtn.click();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it("renders feature details as SEO-friendly text", () => {
    render(<About onBack={() => {}} onPlay={() => {}} />);
    expect(screen.getByText(/four difficulty levels/i)).toBeInTheDocument();
    expect(screen.getAllByText(/peer-to-peer/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/no account/i).length).toBeGreaterThan(0);
  });
});
