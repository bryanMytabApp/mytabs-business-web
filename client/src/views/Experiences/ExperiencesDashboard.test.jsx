import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

jest.mock("../../services/experienceService", () => ({
  listInstances: jest.fn(),
  transitionState: jest.fn(),
}));

import ExperiencesDashboard from "./ExperiencesDashboard";
import { listInstances } from "../../services/experienceService";

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences"]}>
      <Routes>
        <Route path="/admin/my-events/:eventId/experiences" element={<ExperiencesDashboard />} />
      </Routes>
    </MemoryRouter>
  );

describe("ExperiencesDashboard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    listInstances.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders the guided empty state when no instances exist", async () => {
    listInstances.mockResolvedValue({ data: [] });
    renderComponent();

    // The per-event page now renders the shared EngagementsEmptyState card.
    await waitFor(() => {
      expect(screen.getByText("Get your first one live")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /add engagement/i })).toBeInTheDocument();
  });

  it("renders instances grouped by state", async () => {
    listInstances.mockResolvedValue({
      data: [
        { experienceId: "exp-1", name: "VIP Raffle", experienceType: "raffles", state: "Live", entryCount: 10 },
        { experienceId: "exp-2", name: "Fun Poll", experienceType: "live_polls", state: "Draft", entryCount: 0 },
        { experienceId: "exp-3", name: "Trivia Night", experienceType: "trivia", state: "Live", entryCount: 5 },
      ],
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("VIP Raffle")).toBeInTheDocument();
    });
    expect(screen.getByText("Fun Poll")).toBeInTheDocument();
    expect(screen.getByText("Trivia Night")).toBeInTheDocument();
    // "Live" appears as both group header and state chips on cards
    expect(screen.getAllByText("Live").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Draft").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the page title; header Add button is hidden while empty", async () => {
    listInstances.mockResolvedValue({ data: [] });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Event Engagements")).toBeInTheDocument();
    });
    // While empty, the guided card carries the primary action, so the header
    // Add button is intentionally hidden — the only Add Engagement control is
    // the one inside the empty-state card.
    expect(screen.getAllByRole("button", { name: /add engagement/i })).toHaveLength(1);
  });

  it("shows the header Add Engagement button once instances exist", async () => {
    listInstances.mockResolvedValue({
      data: [
        { experienceId: "exp-1", name: "VIP Raffle", experienceType: "raffles", state: "Live", entryCount: 10 },
      ],
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("VIP Raffle")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /add engagement/i })).toBeInTheDocument();
  });

  it("shows error alert on API failure", async () => {
    listInstances.mockRejectedValue(new Error("Network error"));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });
});
