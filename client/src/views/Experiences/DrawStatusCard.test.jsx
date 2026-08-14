import React from "react";
import { render, screen } from "@testing-library/react";
import DrawStatusCard from "./DrawStatusCard";

describe("DrawStatusCard", () => {
  it("renders null when drawType is not provably-fair", () => {
    const { container } = render(
      <DrawStatusCard drawStatus={{}} drawType="standard" drawId="draw-123" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders Draw Pending state when drawStatus is null", () => {
    render(
      <DrawStatusCard drawStatus={null} drawType="provably-fair" drawId="draw-123" />
    );
    expect(screen.getByText("Draw Pending")).toBeInTheDocument();
    expect(screen.getByText("Provably Fair Draw")).toBeInTheDocument();
  });

  it("renders Draw Pending state when drawStatus has no drawState", () => {
    render(
      <DrawStatusCard drawStatus={{}} drawType="provably-fair" drawId="draw-123" />
    );
    expect(screen.getByText("Draw Pending")).toBeInTheDocument();
  });

  it("renders draw status fields when drawState is active", () => {
    const status = {
      drawState: "AWAITING_RANDOMNESS",
      entryCount: 1234,
      lockedAt: "2025-01-15T10:00:00Z",
      drawSeed: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
    };
    render(
      <DrawStatusCard drawStatus={status} drawType="provably-fair" drawId="draw-123" />
    );
    expect(screen.getByText("Provably Fair Draw")).toBeInTheDocument();
    expect(screen.getByText("AWAITING RANDOMNESS")).toBeInTheDocument();
    expect(screen.getByText("1,234")).toBeInTheDocument();
    expect(screen.getByText("NIST Beacon v2.0")).toBeInTheDocument();
    expect(screen.getByText("View Verification")).toBeInTheDocument();
  });

  it("renders green chip for DRAW_COMPLETE state", () => {
    const status = {
      drawState: "DRAW_COMPLETE",
      entryCount: 500,
      lockedAt: "2025-01-15T10:00:00Z",
      drawSeed: "abc123",
      winningTicketId: "ticket-winner-001",
    };
    render(
      <DrawStatusCard drawStatus={status} drawType="provably-fair" drawId="draw-123" />
    );
    expect(screen.getByText("DRAW COMPLETE")).toBeInTheDocument();
    expect(screen.getByText("ticket-winner-001")).toBeInTheDocument();
  });

  it("renders green chip for VERIFIED state", () => {
    const status = {
      drawState: "VERIFIED",
      entryCount: 250,
      lockedAt: "2025-01-15T10:00:00Z",
      drawSeed: "def456",
      winningTicketId: "ticket-winner-002",
    };
    render(
      <DrawStatusCard drawStatus={status} drawType="provably-fair" drawId="draw-123" />
    );
    expect(screen.getByText("VERIFIED")).toBeInTheDocument();
    expect(screen.getByText("ticket-winner-002")).toBeInTheDocument();
  });

  it("does not show winning ticket when draw is not complete", () => {
    const status = {
      drawState: "ENTRIES_LOCKED",
      entryCount: 100,
      lockedAt: "2025-01-15T10:00:00Z",
      drawSeed: "abc123",
      winningTicketId: null,
    };
    render(
      <DrawStatusCard drawStatus={status} drawType="provably-fair" drawId="draw-123" />
    );
    expect(screen.queryByText("Winning Ticket ID")).not.toBeInTheDocument();
  });

  it("opens verification link in new tab on button click", () => {
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => {});
    const status = {
      drawState: "DRAW_COMPLETE",
      entryCount: 10,
      lockedAt: "2025-01-15T10:00:00Z",
      drawSeed: "seed",
    };
    render(
      <DrawStatusCard drawStatus={status} drawType="provably-fair" drawId="my-draw-id" />
    );
    screen.getByText("View Verification").click();
    expect(openSpy).toHaveBeenCalledWith(
      "/verify/raffle/my-draw-id",
      "_blank",
      "noopener,noreferrer"
    );
    openSpy.mockRestore();
  });
});
