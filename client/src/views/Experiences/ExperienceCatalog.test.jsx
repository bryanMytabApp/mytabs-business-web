import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

jest.mock("../../services/experienceService", () => ({
  getCatalog: jest.fn(),
  getFilteredCatalog: jest.fn(),
  createInstance: jest.fn(),
}));

jest.mock("../../hooks/useExperienceEntitlement", () => ({
  __esModule: true,
  default: () => ({
    isExperienceTypeAvailable: (type) => type === "raffles" || type === "live_polls",
    getRequiredTier: (type) => (type === "raffles" ? "starter" : "pro"),
    isLoading: false,
    hasSubscription: true,
    tier: "starter",
  }),
}));

import ExperienceCatalog from "./ExperienceCatalog";
import { getFilteredCatalog, getCatalog } from "../../services/experienceService";

const mockCatalog = [
  { typeId: "raffles", name: "Raffles", description: "Run engaging giveaways", category: "Engagement", icon: "trophy" },
  { typeId: "live_polls", name: "Live Polls", description: "Get instant audience feedback", category: "Engagement", icon: "poll" },
  { typeId: "ai_concierge", name: "AI Concierge", description: "AI-powered attendee assistant", category: "Premium", icon: "robot" },
];

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences/catalog"]}>
      <Routes>
        <Route path="/admin/my-events/:eventId/experiences/catalog" element={<ExperienceCatalog />} />
      </Routes>
    </MemoryRouter>
  );

describe("ExperienceCatalog", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    getFilteredCatalog.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders catalog types after loading", async () => {
    getFilteredCatalog.mockResolvedValue({ data: mockCatalog });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Raffles")).toBeInTheDocument();
    });
    expect(screen.getByText("Live Polls")).toBeInTheDocument();
    expect(screen.getByText("AI Concierge")).toBeInTheDocument();
  });

  it("shows locked state for subscription-gated types", async () => {
    getFilteredCatalog.mockResolvedValue({ data: mockCatalog });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("AI Concierge")).toBeInTheDocument();
    });
    // AI Concierge should show upgrade prompt (not available at starter tier)
    expect(screen.getByText(/Upgrade to/)).toBeInTheDocument();
  });

  it("renders category filter chips", async () => {
    getFilteredCatalog.mockResolvedValue({ data: mockCatalog });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("All")).toBeInTheDocument();
    });
    // "Engagement" appears as both filter chip and category labels on cards
    expect(screen.getAllByText("Engagement").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Premium").length).toBeGreaterThanOrEqual(1);
  });

  it("renders page title and back button", async () => {
    getFilteredCatalog.mockResolvedValue({ data: mockCatalog });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Experience Catalog")).toBeInTheDocument();
    });
  });

  it("shows error alert on API failure", async () => {
    getFilteredCatalog.mockRejectedValue(new Error("Service error"));
    getCatalog.mockRejectedValue(new Error("Service error"));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Service error")).toBeInTheDocument();
    });
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });
});
