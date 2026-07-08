import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import AuthMetricsView from "./AuthMetricsView";
import http from "../../utils/axios/http";

jest.mock("../../utils/axios/http", () => ({
  get: jest.fn(),
}));

jest.mock("react-toastify", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("AuthMetricsView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the dashboard title", async () => {
    http.get.mockRejectedValue(new Error("Not found"));

    render(<AuthMetricsView />);

    await waitFor(() => {
      expect(screen.getByText("Auth Metrics Dashboard")).toBeInTheDocument();
    });
  });

  it("shows placeholder data alert when endpoint is unavailable", async () => {
    http.get.mockRejectedValue(new Error("404"));

    render(<AuthMetricsView />);

    await waitFor(() => {
      expect(
        screen.getByText(/Displaying placeholder data/)
      ).toBeInTheDocument();
    });
  });

  it("renders auth method distribution with provider names", async () => {
    http.get.mockRejectedValue(new Error("Not found"));

    render(<AuthMetricsView />);

    await waitFor(() => {
      expect(screen.getByText("Auth Method Distribution")).toBeInTheDocument();
      expect(screen.getAllByText("Google").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Apple")).toBeInTheDocument();
      expect(screen.getByText("Facebook")).toBeInTheDocument();
      expect(screen.getAllByText("Email").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Phone")).toBeInTheDocument();
      expect(screen.getAllByText("SSO").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders failed attempts section with stats", async () => {
    http.get.mockRejectedValue(new Error("Not found"));

    render(<AuthMetricsView />);

    await waitFor(() => {
      expect(screen.getByText("Failed Attempts & Flagged Accounts")).toBeInTheDocument();
      expect(screen.getByText("47")).toBeInTheDocument();
      expect(screen.getByText("12")).toBeInTheDocument();
    });
  });

  it("renders organization metrics section", async () => {
    http.get.mockRejectedValue(new Error("Not found"));

    render(<AuthMetricsView />);

    await waitFor(() => {
      expect(screen.getByText("Organization Login Metrics")).toBeInTheDocument();
      expect(screen.getByText("Total Members")).toBeInTheDocument();
      expect(screen.getByText("SSO Logins")).toBeInTheDocument();
    });
  });

  it("uses real data from the API when available", async () => {
    http.get.mockResolvedValue({
      data: {
        distribution: [
          { provider: "google", label: "Google", percentage: 60 },
          { provider: "email", label: "Email", percentage: 40 },
        ],
        failedAttempts: {
          last7Days: 10,
          last24Hours: 2,
          flaggedIPs: [],
          flaggedAccounts: 1,
        },
        orgMetrics: null,
      },
    });

    render(<AuthMetricsView />);

    await waitFor(() => {
      expect(screen.getByText("60%")).toBeInTheDocument();
      expect(screen.getByText("40%")).toBeInTheDocument();
      expect(screen.getByText("10")).toBeInTheDocument();
      expect(screen.queryByText(/Displaying placeholder data/)).not.toBeInTheDocument();
    });
  });

  it("shows loading spinner initially", () => {
    http.get.mockReturnValue(new Promise(() => {})); // never resolves

    render(<AuthMetricsView />);

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
