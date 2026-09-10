import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ExperienceLiveRouter from "./ExperienceLiveRouter";
import { getInstance } from "../../services/experienceService";

// jest.mock is hoisted above the imports at runtime, keeping import/first happy.
jest.mock("../../services/experienceService", () => ({
  getInstance: jest.fn(),
}));

// Stub the lazy-loaded dashboards so we assert on dispatch, not their internals.
jest.mock("./RaffleLiveDashboard", () => () => <div>RAFFLE LIVE</div>);
jest.mock("./LivePollLiveDashboard", () => () => <div>LIVE POLL LIVE</div>);
jest.mock("./PulseFeedbackLiveDashboard", () => () => <div>PULSE FEEDBACK LIVE</div>);
jest.mock("./SurveyResultsDashboard", () => () => <div>SURVEY RESULTS</div>);

const renderRouter = () =>
  render(
    <MemoryRouter initialEntries={["/events/evt1/experiences/exp1/live"]}>
      <Routes>
        <Route
          path="/events/:eventId/experiences/:experienceId/live"
          element={<ExperienceLiveRouter />}
        />
      </Routes>
    </MemoryRouter>
  );

describe("ExperienceLiveRouter", () => {
  beforeEach(() => jest.clearAllMocks());

  it("routes pulse-feedback instances to PulseFeedbackLiveDashboard", async () => {
    getInstance.mockResolvedValue({ data: { data: { experienceType: "pulse-feedback" } } });
    renderRouter();
    await waitFor(() => {
      expect(screen.getByText("PULSE FEEDBACK LIVE")).toBeInTheDocument();
    });
  });

  it("routes live-polls instances to LivePollLiveDashboard", async () => {
    getInstance.mockResolvedValue({ data: { data: { experienceType: "live-polls" } } });
    renderRouter();
    await waitFor(() => {
      expect(screen.getByText("LIVE POLL LIVE")).toBeInTheDocument();
    });
  });

  it("routes surveys instances to SurveyResultsDashboard", async () => {
    getInstance.mockResolvedValue({ data: { data: { experienceType: "surveys" } } });
    renderRouter();
    await waitFor(() => {
      expect(screen.getByText("SURVEY RESULTS")).toBeInTheDocument();
    });
  });

  it("defaults to RaffleLiveDashboard for other/unknown types", async () => {
    getInstance.mockResolvedValue({ data: { data: { experienceType: "raffles" } } });
    renderRouter();
    await waitFor(() => {
      expect(screen.getByText("RAFFLE LIVE")).toBeInTheDocument();
    });
  });
});
