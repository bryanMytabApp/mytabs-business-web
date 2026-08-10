import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

jest.mock("../../services/experienceService", () => ({
  getEntries: jest.fn(),
  invalidateEntry: jest.fn(),
}));

import EntryManagement from "./EntryManagement";
import { getEntries } from "../../services/experienceService";

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences/exp-456/entries"]}>
      <Routes>
        <Route
          path="/admin/my-events/:eventId/experiences/:experienceId/entries"
          element={<EntryManagement />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("EntryManagement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    getEntries.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders empty state when no entries found", async () => {
    getEntries.mockResolvedValue({ data: { entries: [] } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("No entries found")).toBeInTheDocument();
    });
  });

  it("renders page title and search controls", async () => {
    getEntries.mockResolvedValue({ data: { entries: [] } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Entry Management")).toBeInTheDocument();
    });
    expect(screen.getByText("Search by Name")).toBeInTheDocument();
    expect(screen.getByText("Search by Entry Code")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
  });

  it("renders entries table with data", async () => {
    getEntries.mockResolvedValue({
      data: {
        entries: [
          {
            entryId: "ent-001-full-id",
            attendeeName: "Alice Johnson",
            entryCode: "ABC123",
            channel: "in-app",
            timestamp: "2026-07-01T12:00:00Z",
            status: "valid",
          },
          {
            entryId: "ent-002-full-id",
            attendeeName: "Bob Smith",
            entryCode: "DEF456",
            channel: "qr-code",
            timestamp: "2026-07-01T13:00:00Z",
            status: "winner",
          },
        ],
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Alice Johnson")).toBeInTheDocument();
    });
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
    expect(screen.getByText("ABC123")).toBeInTheDocument();
    expect(screen.getByText("DEF456")).toBeInTheDocument();
    expect(screen.getByText("Valid")).toBeInTheDocument();
    // "Winner" appears both as status chip and trophy icon titleAccess
    expect(screen.getAllByText("Winner").length).toBeGreaterThanOrEqual(1);
  });

  it("shows error alert on API failure", async () => {
    getEntries.mockRejectedValue(new Error("Network error"));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("shows validation error for name search with fewer than 2 characters", async () => {
    getEntries.mockResolvedValue({ data: { entries: [] } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Entry Management")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Enter attendee name (min 2 characters)...");
    fireEvent.change(input, { target: { value: "A" } });
    fireEvent.click(screen.getByText("Search"));

    expect(screen.getByText("Name search requires at least 2 characters")).toBeInTheDocument();
  });
});
