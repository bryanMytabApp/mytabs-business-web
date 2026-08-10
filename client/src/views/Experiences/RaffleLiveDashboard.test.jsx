import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

jest.mock("../../services/experienceService", () => ({
  getLiveStats: jest.fn(),
  triggerDraw: jest.fn(),
  getEntries: jest.fn(),
  getTimeline: jest.fn(),
  getDrawings: jest.fn(),
}));

import RaffleLiveDashboard from "./RaffleLiveDashboard";
import {
  getLiveStats,
  triggerDraw,
  getEntries,
  getTimeline,
  getDrawings,
} from "../../services/experienceService";

// ─── Helpers ────────────────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences/exp-456/live"]}>
      <Routes>
        <Route path="/admin/my-events/:eventId/experiences/:experienceId/live" element={<RaffleLiveDashboard />} />
      </Routes>
    </MemoryRouter>
  );

const mockStatsResponse = (overrides = {}) => ({
  status: 200,
  headers: {},
  data: {
    data: {
      totalEntries: 42,
      uniqueParticipants: 28,
      entriesLast5Min: 5,
      nextDrawingAt: new Date(Date.now() + 3600000).toISOString(),
      state: "Live",
      experienceName: "Big Prize Raffle",
      potAmount: 0,
      raffleType: null,
      currency: "USD",
      ...overrides,
    },
  },
});

const mockEmptyTimeline = () => ({ data: { data: [] } });
const mockEmptyDrawings = () => ({ data: { data: [] } });
const mockEmptyEntries = () => ({ data: { data: [] } });

function setupDefaultMocks(statsOverrides = {}) {
  getLiveStats.mockResolvedValue(mockStatsResponse(statsOverrides));
  getTimeline.mockResolvedValue(mockEmptyTimeline());
  getDrawings.mockResolvedValue(mockEmptyDrawings());
  getEntries.mockResolvedValue(mockEmptyEntries());
}

// ─── Smoke Tests ────────────────────────────────────────────────────────────────

describe("RaffleLiveDashboard — Smoke Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders without crashing", () => {
    getLiveStats.mockReturnValue(new Promise(() => {}));
    getTimeline.mockReturnValue(new Promise(() => {}));
    getDrawings.mockReturnValue(new Promise(() => {}));
    const { container } = renderComponent();
    expect(container).toBeTruthy();
  });

  it("renders loading spinner initially while stats load", () => {
    getLiveStats.mockReturnValue(new Promise(() => {}));
    getTimeline.mockReturnValue(new Promise(() => {}));
    getDrawings.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders the Live Dashboard header after loading", async () => {
    setupDefaultMocks();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Live Dashboard")).toBeInTheDocument();
    });
  });

  it("renders the LIVE chip indicator", async () => {
    setupDefaultMocks();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("LIVE")).toBeInTheDocument();
    });
  });

  it("renders all four metric card labels", async () => {
    setupDefaultMocks();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Total Entries")).toBeInTheDocument();
    });
    expect(screen.getByText("Unique Participants")).toBeInTheDocument();
    expect(screen.getByText("Entries / 5 min")).toBeInTheDocument();
    expect(screen.getByText("Next Drawing")).toBeInTheDocument();
  });

  it("renders the Activity Timeline section", async () => {
    setupDefaultMocks();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Activity Timeline")).toBeInTheDocument();
    });
  });

  it("renders the Participants section", async () => {
    setupDefaultMocks();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Participants")).toBeInTheDocument();
    });
  });

  it("renders back navigation button", async () => {
    setupDefaultMocks();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("ArrowBackIcon")).toBeInTheDocument();
    });
  });

  it("renders refresh button", async () => {
    setupDefaultMocks();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("RefreshIcon")).toBeInTheDocument();
    });
  });
});

// ─── Unit Tests — Stats Display ─────────────────────────────────────────────────

describe("RaffleLiveDashboard — Stats Display", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("displays total entries value from API", async () => {
    setupDefaultMocks({ totalEntries: 99 });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("99")).toBeInTheDocument();
    });
  });

  it("displays entries per 5 min value from API", async () => {
    setupDefaultMocks({ entriesLast5Min: 7, uniqueParticipants: 0 });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("7")).toBeInTheDocument();
    });
  });

  it("displays experience name in subtitle", async () => {
    setupDefaultMocks({ experienceName: "VIP Giveaway" });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText(/VIP Giveaway/)).toBeInTheDocument();
    });
  });

  it("shows dash when stats fields are null/undefined", async () => {
    getLiveStats.mockResolvedValue({
      status: 200,
      headers: {},
      data: { data: { state: "Live" } },
    });
    getTimeline.mockResolvedValue(mockEmptyTimeline());
    getDrawings.mockResolvedValue(mockEmptyDrawings());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Live Dashboard")).toBeInTheDocument();
    });
    // When values are undefined, nullish coalescing displays "—"
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("displays countdown timer when nextDrawingAt is set", async () => {
    const futureTime = new Date(Date.now() + 3600000).toISOString(); // 1 hour
    setupDefaultMocks({ nextDrawingAt: futureTime });
    renderComponent();

    await waitFor(() => {
      // Should show something like "59m 59s" or "1h 0m 0s"
      expect(screen.getByText(/\d+[hms]/)).toBeInTheDocument();
    });
  });

  it("displays 'Now' when nextDrawingAt is in the past", async () => {
    const pastTime = new Date(Date.now() - 60000).toISOString();
    setupDefaultMocks({ nextDrawingAt: pastTime });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Now")).toBeInTheDocument();
    });
  });
});

// ─── Unit Tests — Pot Ticker ────────────────────────────────────────────────────

describe("RaffleLiveDashboard — Pot Ticker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders pot ticker for 50/50 raffle type", async () => {
    setupDefaultMocks({ potAmount: 25000, raffleType: "50-50" });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("50/50 Pot")).toBeInTheDocument();
    });
  });

  it("renders pot ticker for Progressive raffle type", async () => {
    setupDefaultMocks({ potAmount: 100000, raffleType: "Progressive" });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Progressive Jackpot")).toBeInTheDocument();
    });
  });

  it("does not render pot ticker when potAmount is 0", async () => {
    setupDefaultMocks({ potAmount: 0 });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Live Dashboard")).toBeInTheDocument();
    });
    expect(screen.queryByText("50/50 Pot")).not.toBeInTheDocument();
    expect(screen.queryByText("Progressive Jackpot")).not.toBeInTheDocument();
  });

  it("does not render pot ticker when potAmount is null", async () => {
    setupDefaultMocks({ potAmount: null });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Live Dashboard")).toBeInTheDocument();
    });
    expect(screen.queryByText("50/50 Pot")).not.toBeInTheDocument();
  });
});

// ─── Unit Tests — Drawing Controls ──────────────────────────────────────────────

describe("RaffleLiveDashboard — Drawing Controls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders Trigger Manual Draw button when state is Live", async () => {
    setupDefaultMocks({ state: "Live", totalEntries: 10 });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Trigger Manual Draw")).toBeInTheDocument();
    });
    expect(screen.getByText("Trigger Manual Draw").closest("button")).not.toBeDisabled();
  });

  it("disables draw button when state is not Live", async () => {
    setupDefaultMocks({ state: "Draft", totalEntries: 10 });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Trigger Manual Draw")).toBeInTheDocument();
    });
    expect(screen.getByText("Trigger Manual Draw").closest("button")).toBeDisabled();
  });

  it("disables draw button when totalEntries is 0", async () => {
    setupDefaultMocks({ state: "Live", totalEntries: 0 });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Trigger Manual Draw")).toBeInTheDocument();
    });
    expect(screen.getByText("Trigger Manual Draw").closest("button")).toBeDisabled();
  });

  it("opens confirmation dialog when draw button is clicked", async () => {
    setupDefaultMocks({ state: "Live", totalEntries: 15 });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Trigger Manual Draw")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Trigger Manual Draw"));

    await waitFor(() => {
      expect(screen.getByText("Confirm Manual Drawing")).toBeInTheDocument();
    });
    expect(screen.getByText("Eligible entries: 15")).toBeInTheDocument();
  });

  it("calls triggerDraw and refreshes data on confirmation", async () => {
    setupDefaultMocks({ state: "Live", totalEntries: 20 });
    triggerDraw.mockResolvedValue({ data: { status: "success" } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Trigger Manual Draw")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Trigger Manual Draw"));

    await waitFor(() => {
      expect(screen.getByText("Draw Now")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText("Draw Now"));
    });

    await waitFor(() => {
      expect(triggerDraw).toHaveBeenCalledWith("evt-123", "exp-456");
    });
  });
});

// ─── Unit Tests — Entry Search ──────────────────────────────────────────────────

describe("RaffleLiveDashboard — Entry Search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders the search input", async () => {
    setupDefaultMocks();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search by name or entry code...")).toBeInTheDocument();
    });
  });

  it("calls getEntries when search term is entered", async () => {
    setupDefaultMocks();
    getEntries.mockResolvedValue({
      data: {
        data: [
          { entryId: "e1", attendeeName: "John Doe", entryCode: "ABC123", channel: "in-app", status: "valid" },
        ],
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search by name or entry code...")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search by name or entry code...");
    fireEvent.change(searchInput, { target: { value: "John" } });

    // Debounce fires after 400ms
    act(() => { jest.advanceTimersByTime(500); });

    await waitFor(() => {
      expect(getEntries).toHaveBeenCalledWith("evt-123", "exp-456", expect.objectContaining({ search: "John" }));
    });
  });

  it("displays search results when entries are found", async () => {
    setupDefaultMocks();
    getEntries.mockResolvedValue({
      data: {
        data: [
          { entryId: "e1", attendeeName: "Jane Smith", entryCode: "XYZ789", channel: "qr-scan", status: "valid" },
        ],
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search by name or entry code...")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText("Search by name or entry code...");
    fireEvent.change(searchInput, { target: { value: "Jane" } });
    act(() => { jest.advanceTimersByTime(500); });

    await waitFor(() => {
      expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    });
    expect(screen.getByText(/XYZ789/)).toBeInTheDocument();
  });
});

// ─── Unit Tests — Timeline ──────────────────────────────────────────────────────

describe("RaffleLiveDashboard — Timeline", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows empty state when no timeline events exist", async () => {
    setupDefaultMocks();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("No activity yet")).toBeInTheDocument();
    });
    expect(screen.getByText(/Events will appear here/)).toBeInTheDocument();
  });

  it("renders timeline events when present", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    getTimeline.mockResolvedValue({
      data: {
        data: [
          {
            eventId: "ev-1",
            actionType: "entry",
            message: "Alice joined the raffle",
            timestamp: new Date().toISOString(),
          },
          {
            eventId: "ev-2",
            actionType: "drawing",
            message: "Manual drawing triggered",
            timestamp: new Date().toISOString(),
          },
        ],
      },
    });
    getDrawings.mockResolvedValue(mockEmptyDrawings());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Alice joined the raffle")).toBeInTheDocument();
    });
    expect(screen.getByText("Manual drawing triggered")).toBeInTheDocument();
  });
});

// ─── Unit Tests — Winners Display ───────────────────────────────────────────────

describe("RaffleLiveDashboard — Winners", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not show winners section when there are no drawings", async () => {
    setupDefaultMocks();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Live Dashboard")).toBeInTheDocument();
    });
    expect(screen.queryByText("Winner")).not.toBeInTheDocument();
  });

  it("renders winners from drawing history", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    getTimeline.mockResolvedValue(mockEmptyTimeline());
    getDrawings.mockResolvedValue({
      data: {
        data: [
          {
            drawingId: "d1",
            timestamp: new Date().toISOString(),
            winners: [
              { attendeeName: "Bob Winner", email: "bob@test.com", claimStatus: "claimed" },
            ],
          },
        ],
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Bob Winner")).toBeInTheDocument();
    });
    expect(screen.getByText("bob@test.com")).toBeInTheDocument();
    expect(screen.getByText("claimed")).toBeInTheDocument();
  });

  it("renders multiple winners from multiple drawings", async () => {
    getLiveStats.mockResolvedValue(mockStatsResponse());
    getTimeline.mockResolvedValue(mockEmptyTimeline());
    getDrawings.mockResolvedValue({
      data: {
        data: [
          {
            drawingId: "d1",
            winners: [
              { attendeeName: "Winner One", claimStatus: "claimed" },
              { attendeeName: "Winner Two", claimStatus: "Pending" },
            ],
          },
        ],
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Winner One")).toBeInTheDocument();
    });
    expect(screen.getByText("Winner Two")).toBeInTheDocument();
    expect(screen.getByText("Winners")).toBeInTheDocument(); // plural
  });
});

// ─── Unit Tests — Participants Panel ────────────────────────────────────────────

describe("RaffleLiveDashboard — Participants Panel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows Reveal button to expand participants list", async () => {
    setupDefaultMocks({ uniqueParticipants: 5 });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Reveal")).toBeInTheDocument();
    });
  });

  it("fetches and displays participants when Reveal is clicked", async () => {
    setupDefaultMocks({ uniqueParticipants: 2 });
    getEntries.mockResolvedValue({
      data: {
        data: [
          { entryId: "e1", attendeeName: "Participant A", email: "a@test.com", channel: "in-app" },
          { entryId: "e2", attendeeName: "Participant B", email: "b@test.com", channel: "qr-scan" },
        ],
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Reveal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Reveal"));

    await waitFor(() => {
      expect(getEntries).toHaveBeenCalledWith("evt-123", "exp-456", expect.objectContaining({ limit: 200 }));
    });

    await waitFor(() => {
      expect(screen.getByText("Participant A")).toBeInTheDocument();
    });
    expect(screen.getByText("Participant B")).toBeInTheDocument();
  });

  it("shows empty message when no participants", async () => {
    setupDefaultMocks({ uniqueParticipants: 0 });
    getEntries.mockResolvedValue({ data: { data: [] } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Reveal")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Reveal"));

    await waitFor(() => {
      expect(screen.getByText("No participants yet.")).toBeInTheDocument();
    });
  });
});

// ─── Unit Tests — Error Handling ────────────────────────────────────────────────

describe("RaffleLiveDashboard — Error Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows error alert when getLiveStats fails", async () => {
    getLiveStats.mockRejectedValue({ response: { data: { message: "Server error" } } });
    getTimeline.mockResolvedValue(mockEmptyTimeline());
    getDrawings.mockResolvedValue(mockEmptyDrawings());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("shows generic error when no message in response", async () => {
    getLiveStats.mockRejectedValue({ response: { data: {} } });
    getTimeline.mockResolvedValue(mockEmptyTimeline());
    getDrawings.mockResolvedValue(mockEmptyDrawings());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Failed to load stats")).toBeInTheDocument();
    });
  });

  it("silently handles timeline API failure", async () => {
    setupDefaultMocks();
    getTimeline.mockRejectedValue(new Error("Timeline failed"));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Live Dashboard")).toBeInTheDocument();
    });
    // Should still render, just with empty timeline
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("silently handles drawings API failure", async () => {
    setupDefaultMocks();
    getDrawings.mockRejectedValue(new Error("Drawings failed"));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Live Dashboard")).toBeInTheDocument();
    });
    // Should still render without winner section
    expect(screen.queryByText("Winner")).not.toBeInTheDocument();
  });
});

// ─── Unit Tests — Polling & ETag ────────────────────────────────────────────────

describe("RaffleLiveDashboard — Polling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("polls getLiveStats every 5 seconds", async () => {
    setupDefaultMocks();
    renderComponent();

    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(1);
    });

    act(() => { jest.advanceTimersByTime(5000); });

    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(2);
    });

    act(() => { jest.advanceTimersByTime(5000); });

    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(3);
    });
  });

  it("does not update stats on 304 response", async () => {
    getLiveStats
      .mockResolvedValueOnce(mockStatsResponse({ totalEntries: 10 }))
      .mockResolvedValueOnce({ status: 304, headers: {} });
    getTimeline.mockResolvedValue(mockEmptyTimeline());
    getDrawings.mockResolvedValue(mockEmptyDrawings());
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument();
    });

    act(() => { jest.advanceTimersByTime(5000); });

    // Still shows 10, not dashes
    await waitFor(() => {
      expect(screen.getByText("10")).toBeInTheDocument();
    });
  });

  it("passes ETag header on subsequent requests", async () => {
    getLiveStats.mockResolvedValue({
      status: 200,
      headers: { etag: '"abc123"' },
      data: { data: { totalEntries: 5, state: "Live", uniqueParticipants: 3, entriesLast5Min: 1 } },
    });
    getTimeline.mockResolvedValue(mockEmptyTimeline());
    getDrawings.mockResolvedValue(mockEmptyDrawings());
    renderComponent();

    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(1);
    });

    act(() => { jest.advanceTimersByTime(5000); });

    await waitFor(() => {
      expect(getLiveStats).toHaveBeenCalledTimes(2);
      const secondCall = getLiveStats.mock.calls[1];
      // The config object should have the If-None-Match header
      expect(secondCall[2]).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({ "If-None-Match": '"abc123"' }),
        })
      );
    });
  });
});

// ─── Unit Tests — Navigation ────────────────────────────────────────────────────

describe("RaffleLiveDashboard — Navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockNavigate.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("navigates back to experiences list on back button click", async () => {
    setupDefaultMocks();
    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId("ArrowBackIcon")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("ArrowBackIcon").closest("button"));

    expect(mockNavigate).toHaveBeenCalledWith("/admin/my-events/evt-123/experiences");
  });
});
