import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import ReportHeader from "./ReportHeader";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

const defaultProps = {
  onPrint: jest.fn(),
  onExport: jest.fn(),
  allLoaded: true,
  eventId: "event-123",
  experienceId: "exp-456",
};

function renderHeader(props = {}) {
  return render(
    <MemoryRouter>
      <ReportHeader {...defaultProps} {...props} />
    </MemoryRouter>
  );
}

describe("ReportHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing", () => {
    renderHeader();
    expect(screen.getByLabelText("Back to Drawing History")).toBeInTheDocument();
    expect(screen.getByText("Print / Save as PDF")).toBeInTheDocument();
    expect(screen.getByText("Export Data (JSON)")).toBeInTheDocument();
  });

  it("navigates back to Drawing History on back button click", () => {
    renderHeader();
    fireEvent.click(screen.getByLabelText("Back to Drawing History"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/admin/my-events/event-123/experiences/exp-456/drawings"
    );
  });

  it("calls onPrint when Print button is clicked", () => {
    const onPrint = jest.fn();
    renderHeader({ onPrint });
    fireEvent.click(screen.getByText("Print / Save as PDF"));
    expect(onPrint).toHaveBeenCalledTimes(1);
  });

  it("calls onExport when Export JSON button is clicked", () => {
    const onExport = jest.fn();
    renderHeader({ onExport });
    fireEvent.click(screen.getByText("Export Data (JSON)"));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("disables Export JSON button when allLoaded is false", () => {
    renderHeader({ allLoaded: false });
    expect(screen.getByText("Export Data (JSON)")).toBeDisabled();
  });

  it("enables Export JSON button when allLoaded is true", () => {
    renderHeader({ allLoaded: true });
    expect(screen.getByText("Export Data (JSON)")).not.toBeDisabled();
  });

  it("has report-header-actions className for print hiding", () => {
    const { container } = renderHeader();
    expect(container.querySelector(".report-header-actions")).toBeInTheDocument();
  });
});
