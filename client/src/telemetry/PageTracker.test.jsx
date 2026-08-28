/**
 * Smoke test for the keeptabs web PageTracker.
 *
 * Verifies the tracker renders inside the router without crashing and emits a
 * `screenView` for the initial route plus one on each subsequent navigation.
 * Telemetry is mocked — no SDK/network involved.
 */
import React from "react";
import { render, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate } from "react-router-dom";
import PageTracker from "./PageTracker";

const mockScreenView = jest.fn();
jest.mock("./telemetry", () => ({
  screenView: (s) => mockScreenView(s),
}));

function Nav() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/organizations")}>
      go
    </button>
  );
}

describe("keeptabs web PageTracker (smoke)", () => {
  beforeEach(() => mockScreenView.mockClear());

  it("renders without crashing and emits the initial screen view", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <PageTracker />
        <Routes>
          <Route path="/dashboard" element={<div>dash</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(mockScreenView).toHaveBeenCalledWith("/dashboard");
  });

  it("emits a new screen view on route change", () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={["/"]}>
        <PageTracker />
        <Routes>
          <Route path="/" element={<Nav />} />
          <Route path="/organizations" element={<div>orgs</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(mockScreenView).toHaveBeenCalledWith("/");
    act(() => {
      getByText("go").click();
    });
    expect(mockScreenView).toHaveBeenCalledWith("/organizations");
    expect(mockScreenView).toHaveBeenCalledTimes(2);
  });
});
