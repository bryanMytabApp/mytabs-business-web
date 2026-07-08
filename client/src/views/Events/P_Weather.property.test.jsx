import React from "react";
import { render, screen, act } from "@testing-library/react";
import * as fc from "fast-check";
import { P_Weather } from "./EventCreateNew";

/**
 * Property 1: Next Button Always Enabled
 *
 * For any weather data state (loading, success, error, or no-location),
 * the Weather Preview step SHALL render the "Next" button in a visible
 * and enabled state, allowing forward navigation.
 *
 * **Validates: Requirements 1.7, 6.1**
 */

// Mock the weatherPreviewService module
jest.mock("../../services/weatherPreviewService", () => ({
  getWeatherPreview: jest.fn(),
}));

// Mock react-toastify to avoid side effects
jest.mock("react-toastify", () => ({
  toast: { success: jest.fn(), error: jest.fn() },
}));

const { getWeatherPreview } = require("../../services/weatherPreviewService");

const validWeatherData = {
  currentConditions: {
    temperature: 72,
    feelsLike: 74,
    humidity: 55,
    windSpeed: 8,
    windDirection: "SW",
    precipRate: 0,
    description: "Partly cloudy",
  },
  hourlyForecast: [
    { hour: "2025-07-12T18:00:00Z", temperature: 78, rainProbability: 20, precipRate: 0, windSpeed: 12, conditions: "Clear" },
  ],
  dailyForecast: [
    { date: "2025-07-12", high: 82, low: 65, rainProbability: 30, conditions: "Partly cloudy" },
  ],
  weatherStatus: "Normal",
  alerts: [],
  safetyDisclaimer: "Tabs provides weather information to help you make informed decisions.",
};

describe("Property 1: Next Button Always Enabled", () => {
  const defaultProps = {
    u: jest.fn(),
    next: jest.fn(),
    back: jest.fn(),
    goTo: jest.fn(),
    steps: ["Setup", "Media", "Ticketing", "Weather", "KPIs & Alerts", "Review"],
    stepNum: 4,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("Next button is always present and enabled across all UI states (property-based)", async () => {
    const stateArb = fc.oneof(
      fc.constant("no-location"),
      fc.constant("loading"),
      fc.constant("success"),
      fc.constant("error")
    );

    await fc.assert(
      fc.asyncProperty(stateArb, async (state) => {
        jest.clearAllMocks();

        let formProps;
        let resolvePromise;
        let rejectPromise;

        switch (state) {
          case "no-location":
            // No latitude/longitude in form state
            formProps = { date: "2025-07-12" };
            getWeatherPreview.mockReturnValue(new Promise(() => {}));
            break;

          case "loading":
            // Has location, service returns a promise that never resolves
            formProps = { latitude: 33.749, longitude: -84.388, date: "2025-07-12" };
            getWeatherPreview.mockReturnValue(new Promise(() => {}));
            break;

          case "success":
            // Has location, service resolves with valid data
            formProps = { latitude: 33.749, longitude: -84.388, date: "2025-07-12" };
            getWeatherPreview.mockResolvedValue({ data: validWeatherData });
            break;

          case "error":
            // Has location, service rejects
            formProps = { latitude: 33.749, longitude: -84.388, date: "2025-07-12" };
            getWeatherPreview.mockRejectedValue(new Error("Service unavailable"));
            break;
        }

        let container;
        await act(async () => {
          const result = render(
            <P_Weather {...defaultProps} f={formProps} />
          );
          container = result.container;
        });

        // Find the Next button - it should contain "Next" text
        const nextButton = screen.getByRole("button", { name: /next/i });

        // Assert: Next button exists and is NOT disabled
        expect(nextButton).toBeInTheDocument();
        expect(nextButton).not.toBeDisabled();

        // Cleanup to avoid state leakage between iterations
        container?.parentNode && container.parentNode.removeChild(container);
      }),
      { numRuns: 100 }
    );
  });
});
