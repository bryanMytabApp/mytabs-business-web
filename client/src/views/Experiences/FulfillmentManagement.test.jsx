import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

jest.mock("../../services/experienceService", () => ({
  getFulfillment: jest.fn(),
  updateFulfillment: jest.fn(),
}));

import FulfillmentManagement from "./FulfillmentManagement";
import { getFulfillment } from "../../services/experienceService";

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences/exp-456/fulfillment"]}>
      <Routes>
        <Route
          path="/admin/my-events/:eventId/experiences/:experienceId/fulfillment"
          element={<FulfillmentManagement />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("FulfillmentManagement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    getFulfillment.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders page title and column headers", async () => {
    getFulfillment.mockResolvedValue({ data: { items: [] } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Fulfillment Management")).toBeInTheDocument();
    });
    expect(screen.getByText("Claimed")).toBeInTheDocument();
    expect(screen.getByText("Preparing")).toBeInTheDocument();
    expect(screen.getByText("Shipped")).toBeInTheDocument();
    expect(screen.getByText("In Transit")).toBeInTheDocument();
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it("renders fulfillment items in the correct columns", async () => {
    getFulfillment.mockResolvedValue({
      data: {
        items: [
          {
            entryId: "e-1",
            winnerName: "Alice",
            prizeName: "Gold Trophy",
            status: "Claimed",
            statusUpdatedAt: new Date().toISOString(),
          },
          {
            entryId: "e-2",
            winnerName: "Bob",
            prizeName: "Silver Medal",
            status: "Shipped",
            statusUpdatedAt: new Date().toISOString(),
            carrierName: "UPS",
            trackingNumber: "1Z999AA10123456784",
          },
        ],
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });
    expect(screen.getByText("Gold Trophy")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
    expect(screen.getByText("Silver Medal")).toBeInTheDocument();
    expect(screen.getByText("UPS")).toBeInTheDocument();
  });

  it("shows error alert on API failure", async () => {
    getFulfillment.mockRejectedValue(new Error("Network error"));
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("opens update status dialog on Update Status click", async () => {
    getFulfillment.mockResolvedValue({
      data: {
        items: [
          {
            entryId: "e-1",
            winnerName: "Alice",
            prizeName: "Gold Trophy",
            status: "Claimed",
            statusUpdatedAt: new Date().toISOString(),
          },
        ],
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Update Status"));

    expect(screen.getByText("Update Fulfillment Status")).toBeInTheDocument();
    expect(screen.getByText(/Winner:/)).toBeInTheDocument();
    expect(screen.getByText(/Prize:/)).toBeInTheDocument();
  });

  it("shows empty state in columns with no items", async () => {
    getFulfillment.mockResolvedValue({ data: { items: [] } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Fulfillment Management")).toBeInTheDocument();
    });
    // All columns should show "No items" placeholder
    const noItems = screen.getAllByText("No items");
    expect(noItems.length).toBe(6);
  });
});
