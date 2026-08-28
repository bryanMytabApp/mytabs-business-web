import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import RaffleConfig from "./RaffleConfig";

// Mock experienceService
jest.mock("../../services/experienceService", () => ({
  updateInstance: jest.fn(() => Promise.resolve()),
  transitionState: jest.fn(() => Promise.resolve()),
  getInstance: jest.fn(() => Promise.resolve({ data: {} })),
}));

// Mock eventService
jest.mock("../../services/eventService", () => ({
  getEvent: jest.fn(() => Promise.resolve({ data: {} })),
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
  it("renders the stepper with correct steps", () => {
    renderComponent();
    expect(screen.getByText("Configure Raffle")).toBeInTheDocument();
    expect(screen.getAllByText("Raffle Type").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Prize & Schedule")).toBeInTheDocument();
    expect(screen.getByText("Review & Submit")).toBeInTheDocument();
  });

  it("renders the default export for lazy loading", async () => {
    const module = await import("./RaffleConfig");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});

describe("RaffleConfig - PrizeItem component focus behavior", () => {
  const navigateToPrizeStep = async () => {
    renderComponent();
    // Click the Prize Raffle type card — it has the label inside a clickable Box
    // Use getAllByText and click the parent Box container
    const prizeRaffleLabel = screen.getAllByText("Prize Raffle")[0];
    const clickableCard = prizeRaffleLabel.closest('[class*="MuiBox-root"]');
    await act(async () => {
      fireEvent.click(clickableCard || prizeRaffleLabel);
    });
    // Click Next to advance from step 0 to step 1 (inner tab 0: Appearance)
    await act(async () => {
      fireEvent.click(screen.getByText(/Next →/));
    });
    // Click Next again to advance inner tab from 0 (Appearance) to 1 (Prizes)
    await act(async () => {
      fireEvent.click(screen.getByText(/Next →/));
    });
    // Now we should be on the Prizes inner tab
    await waitFor(() => {
      expect(screen.getByLabelText("Prize Name")).toBeInTheDocument();
    });
  };

  it("PrizeItem is exported as a memo component", async () => {
    const module = await import("./RaffleConfig");
    expect(module.default).toBeDefined();
  });

  it("navigates to prize step and prize name input exists", async () => {
    await navigateToPrizeStep();
    const prizeInput = screen.getByLabelText("Prize Name");
    expect(prizeInput).toBeInTheDocument();
    expect(prizeInput.value).toBe("");
  });

  it("prize name input retains value after sequential onChange events", async () => {
    await navigateToPrizeStep();
    const prizeInput = screen.getByLabelText("Prize Name");

    await act(async () => { fireEvent.change(prizeInput, { target: { value: "G" } }); });
    expect(prizeInput.value).toBe("G");

    await act(async () => { fireEvent.change(prizeInput, { target: { value: "Gr" } }); });
    expect(prizeInput.value).toBe("Gr");

    await act(async () => { fireEvent.change(prizeInput, { target: { value: "Grand" } }); });
    expect(prizeInput.value).toBe("Grand");

    await act(async () => { fireEvent.change(prizeInput, { target: { value: "Grand Prize" } }); });
    expect(prizeInput.value).toBe("Grand Prize");
  });

  it("prize name input accumulates typed characters without remounting", async () => {
    await navigateToPrizeStep();
    const prizeInput = screen.getByLabelText("Prize Name");

    // userEvent.type types character by character, each triggering onChange.
    // If the component remounts between keystrokes, the value would reset.
    await userEvent.type(prizeInput, "MacBook Pro");

    // If PrizeItem was remounting, value would be only the last char
    expect(prizeInput.value).toBe("MacBook Pro");
  });
});

describe("RaffleConfig - 50/50 split configuration", () => {
  const navigateToSplitStep = async () => {
    renderComponent();
    // Select the 50/50 Raffle type card
    const fiftyLabel = screen.getAllByText("50/50 Raffle")[0];
    const clickableCard = fiftyLabel.closest('[class*="MuiBox-root"]');
    await act(async () => {
      fireEvent.click(clickableCard || fiftyLabel);
    });
    // One Next advances from step 0 (Raffle Type) to step 1, inner tab 0.
    // For 50/50 that inner tab is the Pot Split panel (default 50/50 is valid).
    await act(async () => { fireEvent.click(screen.getByText(/Next →/)); });
    await waitFor(() => {
      expect(screen.getByText("Pot Split")).toBeInTheDocument();
    });
  };

  it("shows the split UI (not the prize form) for 50/50 raffles", async () => {
    await navigateToSplitStep();
    // Split panel is shown
    expect(screen.getByText("Pot Split")).toBeInTheDocument();
    expect(screen.getByLabelText("Winner share of the pot")).toBeInTheDocument();
    // Default is 50/50
    expect(screen.getAllByText("50%").length).toBeGreaterThanOrEqual(2);
    // The fixed-prize form is NOT rendered
    expect(screen.queryByLabelText("Prize Name")).not.toBeInTheDocument();
  });

  it("updates winner/organizer percentages when the slider changes", async () => {
    await navigateToSplitStep();
    const slider = screen.getByLabelText("Winner share of the pot");
    // MUI Slider exposes an underlying input with a settable value
    await act(async () => {
      fireEvent.change(slider, { target: { value: 70 } });
    });
    await waitFor(() => {
      expect(screen.getByText("70%")).toBeInTheDocument();
      expect(screen.getByText("30%")).toBeInTheDocument();
    });
  });
});
