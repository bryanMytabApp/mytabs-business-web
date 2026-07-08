/**
 * Property 7: Form State Invariant
 *
 * For any form state object, visiting the Weather Preview step (including loading,
 * success, error, or no-location states) and then navigating away SHALL produce a
 * form state object that is identical to the form state before visiting the step.
 *
 * Key invariant: P_Weather NEVER calls u() — it reads form state but never writes to it.
 *
 * **Validates: Requirements 6.3**
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import * as fc from "fast-check";

// ─── Mock the weather preview service ───
const mockGetWeatherPreview = jest.fn();
jest.mock("../services/weatherPreviewService", () => ({
  getWeatherPreview: (...args) => mockGetWeatherPreview(...args),
}));

// ─── Import P_Weather ───
import { P_Weather } from "../views/Events/EventCreateNew";

// ─── Arbitraries ───────────────────────────────────────────────────────────────

/**
 * Generate an arbitrary form state object that mirrors the event creation form.
 * Includes fields that P_Weather reads (latitude, longitude, date, t1)
 * and additional fields that should remain untouched.
 */
const formStateArbitrary = fc.record({
  latitude: fc.oneof(fc.constant(null), fc.constant(undefined), fc.double({ min: -90, max: 90, noNaN: true })),
  longitude: fc.oneof(fc.constant(null), fc.constant(undefined), fc.double({ min: -180, max: 180, noNaN: true })),
  date: fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant(""), fc.constant("2025-07-10"), fc.constant("2025-07-15")),
  t1: fc.oneof(fc.constant(null), fc.constant(undefined), fc.constant(""), fc.constant("18:00"), fc.constant("09:30")),
  name: fc.string({ minLength: 0, maxLength: 50 }),
  description: fc.oneof(fc.constant(undefined), fc.string({ minLength: 0, maxLength: 100 })),
  venue: fc.oneof(fc.constant(undefined), fc.string({ minLength: 0, maxLength: 50 })),
  ticketPrice: fc.oneof(fc.constant(undefined), fc.double({ min: 0, max: 1000, noNaN: true })),
  capacity: fc.oneof(fc.constant(undefined), fc.integer({ min: 0, max: 10000 })),
});

// ─── Property Tests ────────────────────────────────────────────────────────────

jest.setTimeout(30000);

describe("Property 7: Form State Invariant", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("u() is NEVER called during no-location state rendering", () => {
    fc.assert(
      fc.property(
        formStateArbitrary,
        (formState) => {
          // Force no-location state by removing coordinates
          const f = { ...formState, latitude: null, longitude: null };
          const originalF = JSON.parse(JSON.stringify(f));
          const mockU = jest.fn();

          const { unmount } = render(
            <P_Weather
              f={f}
              u={mockU}
              next={jest.fn()}
              back={jest.fn()}
              goTo={jest.fn()}
              steps={[]}
              stepNum={4}
            />
          );

          // u was never called
          expect(mockU).not.toHaveBeenCalled();
          // form state was not mutated
          expect(JSON.parse(JSON.stringify(f))).toEqual(originalF);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("u() is NEVER called during loading state", async () => {
    await fc.assert(
      fc.asyncProperty(
        formStateArbitrary,
        async (formState) => {
          // Ensure location is present so fetch is triggered
          const f = {
            ...formState,
            latitude: 33.749,
            longitude: -84.388,
            date: "2025-07-10",
          };
          const originalF = JSON.parse(JSON.stringify(f));
          const mockU = jest.fn();

          // Mock returns a promise that never resolves (stays in loading state)
          mockGetWeatherPreview.mockReturnValue(new Promise(() => {}));

          const { unmount } = render(
            <P_Weather
              f={f}
              u={mockU}
              next={jest.fn()}
              back={jest.fn()}
              goTo={jest.fn()}
              steps={[]}
              stepNum={4}
            />
          );

          // u was never called during loading
          expect(mockU).not.toHaveBeenCalled();
          // form state was not mutated
          expect(JSON.parse(JSON.stringify(f))).toEqual(originalF);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("u() is NEVER called after successful weather fetch", async () => {
    await fc.assert(
      fc.asyncProperty(
        formStateArbitrary,
        async (formState) => {
          const f = {
            ...formState,
            latitude: 33.749,
            longitude: -84.388,
            date: "2025-07-10",
          };
          const originalF = JSON.parse(JSON.stringify(f));
          const mockU = jest.fn();

          // Mock successful response
          mockGetWeatherPreview.mockResolvedValue({
            data: {
              weatherStatus: "Normal",
              currentConditions: {
                temperature: 72,
                feelsLike: 74,
                humidity: 55,
                windSpeed: 8,
                windDirection: "SW",
                precipRate: 0,
                rainProbability: 20,
                description: "Partly cloudy",
                icon: "partly-cloudy-day",
                timestamp: "2025-07-10T14:00:00Z",
                source: "openmeteo",
              },
              hourlyForecast: [
                { hour: "2025-07-10T18:00:00Z", temperature: 78, rainProbability: 20, precipRate: 0, windSpeed: 12, conditions: "Clear", thunderstormRisk: 0, lightningRisk: 0 },
              ],
              dailyForecast: [
                { date: "2025-07-10", high: 82, low: 65, rainProbability: 30, conditions: "Partly cloudy", sunrise: "06:12", sunset: "20:45", windSpeed: 15 },
              ],
              alerts: [],
              safetyDisclaimer: "Weather information is provided for informational purposes only.",
            },
          });

          const { unmount } = render(
            <P_Weather
              f={f}
              u={mockU}
              next={jest.fn()}
              back={jest.fn()}
              goTo={jest.fn()}
              steps={[]}
              stepNum={4}
            />
          );

          // Wait for the fetch to complete and component to re-render
          await act(async () => {
            await new Promise((r) => setTimeout(r, 0));
          });

          // u was NEVER called
          expect(mockU).not.toHaveBeenCalled();
          // form state was not mutated
          expect(JSON.parse(JSON.stringify(f))).toEqual(originalF);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("u() is NEVER called after failed weather fetch (error state)", async () => {
    await fc.assert(
      fc.asyncProperty(
        formStateArbitrary,
        async (formState) => {
          const f = {
            ...formState,
            latitude: 33.749,
            longitude: -84.388,
            date: "2025-07-10",
          };
          const originalF = JSON.parse(JSON.stringify(f));
          const mockU = jest.fn();

          // Mock failed response
          mockGetWeatherPreview.mockRejectedValue(new Error("Service unavailable"));

          const { unmount } = render(
            <P_Weather
              f={f}
              u={mockU}
              next={jest.fn()}
              back={jest.fn()}
              goTo={jest.fn()}
              steps={[]}
              stepNum={4}
            />
          );

          // Wait for the fetch to fail and component to re-render
          await act(async () => {
            await new Promise((r) => setTimeout(r, 0));
          });

          // u was NEVER called
          expect(mockU).not.toHaveBeenCalled();
          // form state was not mutated
          expect(JSON.parse(JSON.stringify(f))).toEqual(originalF);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  it("form state object is not mutated across all UI states (combined)", async () => {
    await fc.assert(
      fc.asyncProperty(
        formStateArbitrary,
        fc.oneof(fc.constant("success"), fc.constant("error"), fc.constant("no-location")),
        async (formState, scenario) => {
          let f;
          if (scenario === "no-location") {
            f = { ...formState, latitude: null, longitude: null };
          } else {
            f = { ...formState, latitude: 33.749, longitude: -84.388, date: "2025-07-10" };
          }

          const originalF = JSON.parse(JSON.stringify(f));
          const mockU = jest.fn();

          if (scenario === "success") {
            mockGetWeatherPreview.mockResolvedValue({
              data: {
                weatherStatus: "Normal",
                currentConditions: { temperature: 72, description: "Sunny", windSpeed: 5, rainProbability: 10 },
                hourlyForecast: [],
                dailyForecast: [],
                alerts: [],
                safetyDisclaimer: "Disclaimer text.",
              },
            });
          } else if (scenario === "error") {
            mockGetWeatherPreview.mockRejectedValue(new Error("Timeout"));
          }

          const { unmount } = render(
            <P_Weather
              f={f}
              u={mockU}
              next={jest.fn()}
              back={jest.fn()}
              goTo={jest.fn()}
              steps={[]}
              stepNum={4}
            />
          );

          if (scenario !== "no-location") {
            await act(async () => {
              await new Promise((r) => setTimeout(r, 0));
            });
          }

          // INVARIANT 1: u() was NEVER called
          expect(mockU).not.toHaveBeenCalled();
          // INVARIANT 2: form state was not mutated (deep equality)
          expect(JSON.parse(JSON.stringify(f))).toEqual(originalF);

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
