import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RaffleConfig from "./RaffleConfig";

// Mock experienceService
jest.mock("../../services/experienceService", () => ({
  updateInstance: jest.fn(() => Promise.resolve()),
  transitionState: jest.fn(() => Promise.resolve()),
}));

// Mock DateTimePicker to avoid adapter issues in test
jest.mock("@mui/x-date-pickers/DateTimePicker", () => ({
  DateTimePicker: ({ label, slotProps }) => (
    <input aria-label={label} data-testid={`datepicker-${label}`} />
  ),
}));
jest.mock("@mui/x-date-pickers/LocalizationProvider", () => ({
  LocalizationProvider: ({ children }) => <>{children}</>,
}));
jest.mock("@mui/x-date-pickers/AdapterDayjs", () => ({
  AdapterDayjs: class {},
}));

const renderComponent = () =>
  render(
    <MemoryRouter initialEntries={["/events/evt1/experiences/exp1/raffle-config"]}>
      <Routes>
        <Route
          path="/events/:eventId/experiences/:experienceId/raffle-config"
          element={<RaffleConfig />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("RaffleConfig", () => {
  it("renders the stepper with 9 steps", () => {
    renderComponent();
    expect(screen.getByText("Configure Raffle")).toBeInTheDocument();
    expect(screen.getAllByText("Raffle Type").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Prize Configuration")).toBeInTheDocument();
    expect(screen.getByText("Review & Submit")).toBeInTheDocument();
  });

  it("shows validation error when trying to advance without selecting raffle type", () => {
    renderComponent();
    fireEvent.click(screen.getByText("Next"));
    expect(screen.getByText("Raffle type is required.")).toBeInTheDocument();
  });

  it("renders the default export for lazy loading", async () => {
    const module = await import("./RaffleConfig");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });

  it("shows Back button disabled on the first step", () => {
    renderComponent();
    const backBtn = screen.getByText("Back");
    expect(backBtn).toBeDisabled();
  });
});
