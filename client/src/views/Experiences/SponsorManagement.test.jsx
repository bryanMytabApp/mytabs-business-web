import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

jest.mock("../../services/experienceService", () => ({
  getInstance: jest.fn(),
  updateInstance: jest.fn(),
}));

import SponsorManagement from "./SponsorManagement";
import { getInstance } from "../../services/experienceService";

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences/exp-456/sponsor"]}>
      <Routes>
        <Route
          path="/admin/my-events/:eventId/experiences/:experienceId/sponsor"
          element={<SponsorManagement />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("SponsorManagement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loading state initially", () => {
    getInstance.mockReturnValue(new Promise(() => {}));
    renderComponent();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  it("renders sponsor form after loading (no existing sponsor)", async () => {
    getInstance.mockResolvedValue({ data: { data: {} } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Management")).toBeInTheDocument();
    });
    expect(screen.getByText("Sponsor Branding")).toBeInTheDocument();
    expect(screen.getByLabelText("Display Name")).toBeInTheDocument();
    expect(screen.getByText("Save Sponsor")).toBeInTheDocument();
  });

  it("populates form with existing sponsor data", async () => {
    getInstance.mockResolvedValue({
      data: {
        data: {
          sponsor: {
            displayName: "Acme Corp",
            brandColors: ["#FF0000", "#00FF00"],
            placement: "footer_badge",
            monetizationModel: "premium-placement",
            paymentStatus: "captured",
            logoUrl: "https://example.com/logo.png",
          },
        },
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Acme Corp")).toBeInTheDocument();
    });
    // Disassociate button should appear for existing sponsors
    expect(screen.getByText("Disassociate")).toBeInTheDocument();
    // Payment status chip should render
    expect(screen.getByText("Captured")).toBeInTheDocument();
  });

  it("shows error alert on API failure", async () => {
    getInstance.mockRejectedValue({
      response: { data: { message: "Failed to load experience data." } },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Failed to load experience data.")).toBeInTheDocument();
    });
  });

  it("opens disassociate confirmation dialog", async () => {
    getInstance.mockResolvedValue({
      data: {
        data: {
          sponsor: {
            displayName: "Big Sponsor",
            brandColors: ["#F09925"],
            placement: "header_banner",
            monetizationModel: "sponsor-funded",
          },
        },
      },
    });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Disassociate")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Disassociate"));

    expect(screen.getByText("Disassociate Sponsor?")).toBeInTheDocument();
    expect(
      screen.getByText(/remove the sponsor's branding/)
    ).toBeInTheDocument();
  });

  it("renders Add Color button and allows adding brand colors", async () => {
    getInstance.mockResolvedValue({ data: { data: {} } });
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText("Add Color")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Add Color"));
    // After adding, there should be 2 color inputs (initial + added)
    const colorInputs = screen.getAllByDisplayValue(/#[0-9A-Fa-f]{6}/);
    expect(colorInputs.length).toBe(2);
  });
});
