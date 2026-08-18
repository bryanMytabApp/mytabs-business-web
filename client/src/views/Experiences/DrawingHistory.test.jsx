import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

jest.mock("../../services/experienceService", () => ({
  getDrawings: jest.fn(),
}));

import DrawingHistory from "./DrawingHistory";
import { getDrawings } from "../../services/experienceService";

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences/exp-456/drawings"]}>
      <Routes>
        <Route path="/admin/my-events/:eventId/experiences/:experienceId/drawings" element={<DrawingHistory />} />
      </Routes>
    </MemoryRouter>
  );

describe("DrawingHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    getDrawings.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders empty state when no drawings exist", async () => {
    getDrawings.mockResolvedValue({ data: { items: [] } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("No drawings yet")).toBeInTheDocument();
    });
  });

  it("renders drawing rows", async () => {
    getDrawings.mockResolvedValue({
      data: {
        items: [
          {
            drawingId: "draw-1",
            timestamp: "2026-06-30T14:00:00Z",
            triggerMethod: "manual",
            totalEntries: 50,
            winners: [
              { entryId: "e-1", userId: "user-1", entryCode: "ABC123", claimStatus: "claimed" },
              { entryId: "e-2", userId: "user-2", entryCode: "DEF456", claimStatus: "pending" },
            ],
          },
          {
            drawingId: "draw-2",
            timestamp: "2026-06-29T10:00:00Z",
            triggerMethod: "scheduled",
            totalEntries: 30,
            winners: [
              { entryId: "e-3", userId: "user-3", entryCode: "GHI789", claimStatus: "forfeited" },
            ],
          },
        ],
        nextCursor: null,
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Drawing History")).toBeInTheDocument();
    });
    expect(screen.getByText("manual")).toBeInTheDocument();
    expect(screen.getByText("scheduled")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("expands row to show winner details", async () => {
    getDrawings.mockResolvedValue({
      data: {
        items: [
          {
            drawingId: "draw-1",
            timestamp: "2026-06-30T14:00:00Z",
            triggerMethod: "manual",
            totalEntries: 20,
            winners: [
              { entryId: "e-1", userId: "user-1", entryCode: "XYZ999", claimStatus: "claimed" },
            ],
          },
        ],
        nextCursor: null,
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("manual")).toBeInTheDocument();
    });

    // Click expand button
    const expandButtons = screen.getAllByLabelText("expand row");
    fireEvent.click(expandButtons[0]);

    await waitFor(() => {
      expect(screen.getByText("Winner Details")).toBeInTheDocument();
    });
    expect(screen.getByText("XYZ999")).toBeInTheDocument();
    expect(screen.getByText("claimed")).toBeInTheDocument();
  });

  it("shows error alert on API failure", async () => {
    getDrawings.mockRejectedValue({ response: { data: { message: "Not found" } } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Not found")).toBeInTheDocument();
    });
  });

  it("shows Load More button when cursor exists", async () => {
    getDrawings.mockResolvedValue({
      data: {
        items: [
          { drawingId: "draw-1", timestamp: "2026-06-30T14:00:00Z", triggerMethod: "manual", totalEntries: 10, winners: [] },
        ],
        nextCursor: "next-page",
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Load More")).toBeInTheDocument();
    });
  });

  it("renders Export Draw Report button", async () => {
    getDrawings.mockResolvedValue({ data: { items: [] } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Export Draw Report")).toBeInTheDocument();
    });
    const btn = screen.getByText("Export Draw Report");
    expect(btn.closest("button")).toHaveAttribute("type", "button");
  });

  it("navigates to draw-report page on Export Draw Report click", async () => {
    getDrawings.mockResolvedValue({ data: { items: [] } });
    const { container } = render(
      <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences/exp-456/drawings"]}>
        <Routes>
          <Route path="/admin/my-events/:eventId/experiences/:experienceId/drawings" element={<DrawingHistory />} />
          <Route path="/admin/my-events/:eventId/experiences/:experienceId/draw-report" element={<div data-testid="draw-report-page">Report</div>} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Export Draw Report")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Export Draw Report"));

    await waitFor(() => {
      expect(screen.getByTestId("draw-report-page")).toBeInTheDocument();
    });
  });
});
