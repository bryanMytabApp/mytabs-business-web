import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

jest.mock("../../services/experienceService", () => ({
  getAnalytics: jest.fn(),
  exportAnalytics: jest.fn(),
}));

// Mock recharts to avoid rendering issues in test environment
jest.mock("recharts", () => ({
  LineChart: ({ children }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  BarChart: ({ children }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  PieChart: ({ children }) => <div data-testid="pie-chart">{children}</div>,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }) => <div data-testid="responsive-container">{children}</div>,
  Legend: () => null,
}));

import ExperienceAnalytics from "./ExperienceAnalytics";
import { getAnalytics } from "../../services/experienceService";

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences/exp-456/analytics"]}>
      <Routes>
        <Route
          path="/admin/my-events/:eventId/experiences/:experienceId/analytics"
          element={<ExperienceAnalytics />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("ExperienceAnalytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    getAnalytics.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders analytics metrics after loading", async () => {
    getAnalytics.mockResolvedValue({
      data: {
        data: {
          metrics: {
            totalParticipants: 150,
            totalEntries: 300,
            peakConcurrent: 42,
            avgTimeToParticipate: 8,
            completionRate: 0.85,
          },
          entriesOverTime: [
            { time: "12:00", entries: 10 },
            { time: "13:00", entries: 25 },
          ],
          demographics: [
            { ticketType: "VIP", participants: 20, entries: 50 },
          ],
          entryChannels: [
            { channel: "in-app", value: 60 },
            { channel: "qr-code", value: 40 },
          ],
        },
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("150")).toBeInTheDocument();
    });
    expect(screen.getByText("300")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("8s")).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(screen.getByText("Total Participants")).toBeInTheDocument();
    expect(screen.getByText("Total Entries")).toBeInTheDocument();
    expect(screen.getByText("Export CSV")).toBeInTheDocument();
  });

  it("renders page title", async () => {
    getAnalytics.mockResolvedValue({
      data: { data: { metrics: {}, entriesOverTime: [], demographics: [], entryChannels: [] } },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Analytics")).toBeInTheDocument();
    });
  });

  it("shows error alert and retry button on API failure", async () => {
    getAnalytics.mockRejectedValue({
      response: { data: { message: "Failed to load analytics data." } },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Failed to load analytics data.")).toBeInTheDocument();
    });
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });

  it("renders chart sections with data", async () => {
    getAnalytics.mockResolvedValue({
      data: {
        data: {
          metrics: { totalParticipants: 10, totalEntries: 20 },
          entriesOverTime: [{ time: "10:00", entries: 5 }],
          demographics: [{ ticketType: "GA", participants: 5, entries: 10 }],
          entryChannels: [{ channel: "in-app", value: 100 }],
        },
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Entries Over Time")).toBeInTheDocument();
    });
    expect(screen.getByText("Entry Channels")).toBeInTheDocument();
    expect(screen.getByText("Demographics by Ticket Type")).toBeInTheDocument();
  });
});
