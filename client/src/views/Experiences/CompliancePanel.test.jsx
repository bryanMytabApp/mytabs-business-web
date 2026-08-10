import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

jest.mock("../../services/experienceService", () => ({
  validateJurisdiction: jest.fn(),
  acknowledgeCompliance: jest.fn(),
}));

import CompliancePanel from "./CompliancePanel";
import { validateJurisdiction, acknowledgeCompliance } from "../../services/experienceService";

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/admin/my-events/evt-123/experiences/exp-456/compliance"]}>
      <Routes>
        <Route
          path="/admin/my-events/:eventId/experiences/:experienceId/compliance"
          element={<CompliancePanel />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("CompliancePanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the page title and jurisdiction selection", () => {
    renderComponent();
    expect(screen.getByText("Compliance")).toBeInTheDocument();
    expect(screen.getByText("Jurisdiction Selection")).toBeInTheDocument();
    expect(screen.getByText("Check Compliance")).toBeInTheDocument();
  });

  it("disables Check Compliance button when no jurisdiction selected", () => {
    renderComponent();
    const button = screen.getByText("Check Compliance").closest("button");
    expect(button).toBeDisabled();
  });

  it("shows compliant status with green indicator", async () => {
    validateJurisdiction.mockResolvedValue({
      data: {
        data: {
          status: "compliant",
          warnings: [],
          disclosures: ["Odds of winning depend on number of entries received."],
          acknowledged: false,
        },
      },
    });

    renderComponent();

    // Switch to custom jurisdiction and type one in
    fireEvent.click(screen.getByText("Custom"));
    const input = screen.getByLabelText("Jurisdiction Code");
    fireEvent.change(input, { target: { value: "US-TX" } });
    fireEvent.click(screen.getByText("Check Compliance"));

    await waitFor(() => {
      expect(screen.getByText("Compliant")).toBeInTheDocument();
    });
    expect(screen.getByText("Odds of winning depend on number of entries received.")).toBeInTheDocument();
  });

  it("shows restricted status with acknowledgment flow", async () => {
    validateJurisdiction.mockResolvedValue({
      data: {
        data: {
          status: "restricted",
          warnings: ["50/50 raffles may require a gambling license in this jurisdiction."],
          disclosures: ["No purchase necessary. Void where prohibited."],
          acknowledged: false,
        },
      },
    });

    renderComponent();

    fireEvent.click(screen.getByText("Custom"));
    const input = screen.getByLabelText("Jurisdiction Code");
    fireEvent.change(input, { target: { value: "US-CA" } });
    fireEvent.click(screen.getByText("Check Compliance"));

    await waitFor(() => {
      expect(screen.getByText(/Restricted/)).toBeInTheDocument();
    });
    expect(screen.getByText("50/50 raffles may require a gambling license in this jurisdiction.")).toBeInTheDocument();
    expect(screen.getByText("Acknowledgment Required")).toBeInTheDocument();
    expect(screen.getByText("Confirm Acknowledgment")).toBeInTheDocument();
  });

  it("enables confirm button only after checkbox is checked", async () => {
    validateJurisdiction.mockResolvedValue({
      data: {
        data: {
          status: "restricted",
          warnings: ["Warning"],
          disclosures: [],
          acknowledged: false,
        },
      },
    });

    renderComponent();

    fireEvent.click(screen.getByText("Custom"));
    fireEvent.change(screen.getByLabelText("Jurisdiction Code"), { target: { value: "US-NY" } });
    fireEvent.click(screen.getByText("Check Compliance"));

    await waitFor(() => {
      expect(screen.getByText("Confirm Acknowledgment")).toBeInTheDocument();
    });

    // Button should be disabled initially
    expect(screen.getByText("Confirm Acknowledgment").closest("button")).toBeDisabled();

    // Check the acknowledgment checkbox
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);

    expect(screen.getByText("Confirm Acknowledgment").closest("button")).not.toBeDisabled();
  });
});
