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

  it("renders empty state when no instances exist", async () => {
    listInstances.mockResolvedValue({ data: [] });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("No experiences yet")).toBeInTheDocument();
    });
    expect(screen.getByText("Browse Catalog")).toBeInTheDocument();
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

  it("renders the page title and Add Experience button", async () => {
    listInstances.mockResolvedValue({ data: [] });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Event Experiences")).toBeInTheDocument();
    });
    expect(screen.getByText("Add Experience")).toBeInTheDocument();
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
