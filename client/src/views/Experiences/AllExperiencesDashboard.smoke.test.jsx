import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AllExperiencesDashboard from "./AllExperiencesDashboard";
import http from "../../utils/axios/http";
import { listAllExperiences } from "../../services/experienceService";

// The dashboard loads events via the shared http client, then loads
// experiences per event. Mock both so the smoke test renders the empty state
// (header + actions) without hitting the network.
jest.mock("../../utils/axios/http", () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock("../../services/experienceService", () => ({
  listAllExperiences: jest.fn(),
  deleteInstance: jest.fn(),
}));

jest.mock("../../utils/authUtils", () => ({
  getCurrentUserId: () => "user-123",
  buildAuthenticatedReturnUrl: (base, token, userId) =>
    `${base}?token=${token}&userId=${userId}`,
}));

const renderComponent = () =>
  render(
    <MemoryRouter>
      <AllExperiencesDashboard />
    </MemoryRouter>
  );

describe("AllExperiencesDashboard (smoke)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.setItem("idToken", "tok-abc");
    localStorage.setItem("userId", "user-123");
    // No events for this business -> renders the empty state + header actions.
    http.get.mockResolvedValue({ data: { data: [] } });
    listAllExperiences.mockResolvedValue({ events: [] });
  });

  it("renders the black-and-orange split header title", async () => {
    renderComponent();

    // "Tab" stays dark, "Engagements" is the orange span (mirrors the
    // Ticket Management header). Assert both fragments render.
    expect(await screen.findByText("Tab")).toBeInTheDocument();
    const orange = screen.getByText("Engagements");
    expect(orange).toBeInTheDocument();
    expect(orange).toHaveStyle({ color: "#f97316" });
  });

  it("renders a Verify Engagements button that opens the engage verify app with SSO params", async () => {
    const openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
    renderComponent();

    const verifyBtn = await screen.findByRole("button", { name: /verify engagements/i });
    expect(verifyBtn).toBeInTheDocument();

    verifyBtn.click();

    expect(openSpy).toHaveBeenCalledWith(
      "https://verify.engage.keeptabs.app?token=tok-abc&userId=user-123",
      "_blank",
      "noopener,noreferrer"
    );

    openSpy.mockRestore();
  });
});
