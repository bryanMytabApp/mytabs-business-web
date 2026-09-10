import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ExperienceConfigRouter from "./ExperienceConfigRouter";
import { getInstance } from "../../services/experienceService";

// jest.mock is hoisted above the imports at runtime, keeping import/first happy.
jest.mock("../../services/experienceService", () => ({
  getInstance: jest.fn(),
}));

// Stub the lazy-loaded screens so we assert on dispatch, not their internals.
jest.mock("./RaffleConfig", () => () => <div>RAFFLE CONFIG</div>);
jest.mock("./LivePollConfig", () => () => <div>LIVE POLL CONFIG</div>);
jest.mock("./PulseFeedbackConfig", () => () => <div>PULSE FEEDBACK CONFIG</div>);
jest.mock("./SurveyConfig", () => () => <div>SURVEY CONFIG</div>);

const renderRouter = () =>
  render(
    <MemoryRouter initialEntries={["/events/evt1/experiences/exp1/config"]}>
      <Routes>
        <Route
          path="/events/:eventId/experiences/:experienceId/config"
          element={<ExperienceConfigRouter />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("ExperienceConfigRouter", () => {
  beforeEach(() => jest.clearAllMocks());

  it("routes pulse-feedback instances to PulseFeedbackConfig", async () => {
    getInstance.mockResolvedValue({ data: { data: { experienceType: "pulse-feedback" } } });
    renderRouter();
    await waitFor(() => {
      expect(screen.getByText("PULSE FEEDBACK CONFIG")).toBeInTheDocument();
    });
  });

  it("routes live-polls instances to LivePollConfig", async () => {
    getInstance.mockResolvedValue({ data: { data: { experienceType: "live-polls" } } });
    renderRouter();
    await waitFor(() => {
      expect(screen.getByText("LIVE POLL CONFIG")).toBeInTheDocument();
    });
  });

  it("routes surveys instances to SurveyConfig", async () => {
    getInstance.mockResolvedValue({ data: { data: { experienceType: "surveys" } } });
    renderRouter();
    await waitFor(() => {
      expect(screen.getByText("SURVEY CONFIG")).toBeInTheDocument();
    });
  });

  it("defaults to RaffleConfig for other/unknown types", async () => {
    getInstance.mockResolvedValue({ data: { data: { experienceType: "raffles" } } });
    renderRouter();
    await waitFor(() => {
      expect(screen.getByText("RAFFLE CONFIG")).toBeInTheDocument();
    });
  });
});
