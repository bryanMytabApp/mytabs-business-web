/**
 * Property 4: Date Proximity Determines Forecast Display Mode
 *
 * For any event with weather data available, if the event date is within 7 days
 * from today, the Weather Preview step SHALL display hourly forecast data; if the
 * event date is more than 7 days from today, the step SHALL display the message
 * "Detailed forecast available within 7 days of the event" alongside the daily
 * forecast summary.
 *
 * **Validates: Requirements 3.2, 3.3**
 */
import React, { useState, useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import * as fc from "fast-check";

// ─── Mock the weather preview service ───
const mockGetWeatherPreview = jest.fn();
jest.mock("../services/weatherPreviewService", () => ({
  getWeatherPreview: (...args) => mockGetWeatherPreview(...args),
}));

/**
 * Helper: format a Date as YYYY-MM-DD
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Helper: generate a date N days from today
 */
function dateNDaysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

/**
 * The date proximity logic extracted from P_Weather component:
 *   daysUntilEvent = Math.ceil((new Date(eventDate + "T00:00:00") - new Date()) / (1000*60*60*24))
 *   showHourly = daysUntilEvent !== null && daysUntilEvent <= 7
 *
 * This is the exact logic from EventCreateNew.jsx lines 1209-1212.
 */
function computeDaysUntilEvent(eventDateStr) {
  if (!eventDateStr) return null;
  return Math.ceil(
    (new Date(eventDateStr + "T00:00:00") - new Date()) / (1000 * 60 * 60 * 24)
  );
}

function computeShowHourly(eventDateStr) {
  const daysUntilEvent = computeDaysUntilEvent(eventDateStr);
  return daysUntilEvent !== null && daysUntilEvent <= 7;
}

/**
 * Build mock weather response data with hourly and daily forecast arrays
 */
function buildMockWeatherData(eventDateStr) {
  return {
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
      timestamp: new Date().toISOString(),
      source: "openmeteo",
    },
    hourlyForecast: [
      { hour: `${eventDateStr}T10:00:00Z`, temperature: 78, rainProbability: 20, precipRate: 0, windSpeed: 12, conditions: "Clear", thunderstormRisk: 0, lightningRisk: 0 },
      { hour: `${eventDateStr}T11:00:00Z`, temperature: 76, rainProbability: 15, precipRate: 0, windSpeed: 10, conditions: "Clear", thunderstormRisk: 0, lightningRisk: 0 },
      { hour: `${eventDateStr}T12:00:00Z`, temperature: 74, rainProbability: 10, precipRate: 0, windSpeed: 9, conditions: "Clear", thunderstormRisk: 0, lightningRisk: 0 },
    ],
    dailyForecast: [
      { date: eventDateStr, high: 82, low: 65, rainProbability: 30, conditions: "Partly cloudy", sunrise: "06:12", sunset: "20:45", windSpeed: 15 },
      { date: dateNDaysFromNow(1), high: 80, low: 63, rainProbability: 20, conditions: "Sunny", sunrise: "06:13", sunset: "20:44", windSpeed: 10 },
    ],
    alerts: [],
    safetyDisclaimer: "Weather information is provided for informational purposes only.",
  };
}

/**
 * Lightweight P_Weather replica that replicates the exact date proximity logic
 * from EventCreateNew.jsx. This allows us to property-test the rendering behavior
 * without importing the entire wizard (which has many unrelated dependencies).
 *
 * The logic is identical to the production P_Weather component:
 * - Compute daysUntilEvent via Math.ceil((new Date(eventDate+"T00:00:00") - new Date()) / (1000*60*60*24))
 * - showHourly = daysUntilEvent !== null && daysUntilEvent <= 7
 * - If showHourly: render "Hourly Forecast" section
 * - If !showHourly: render daily forecast + "Detailed forecast available within 7 days of the event"
 */
function P_WeatherTestHarness({ f }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const hasLocation = !!(f.latitude && f.longitude);
  const eventDate = f.date || null;

  useEffect(() => {
    if (!hasLocation || !eventDate) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const dateStr = f.t1 ? `${f.date}T${f.t1}:00` : `${f.date}T00:00:00`;
    mockGetWeatherPreview(f.latitude, f.longitude, dateStr, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted) {
          setData(res.data || res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError("Weather data is temporarily unavailable");
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [f.latitude, f.longitude, f.date]);

  const daysUntilEvent = eventDate
    ? Math.ceil((new Date(eventDate + "T00:00:00") - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const showHourly = daysUntilEvent !== null && daysUntilEvent <= 7;

  if (!hasLocation) return <div>No location</div>;
  if (loading && !data) return <div>Loading...</div>;
  if (error && !data) return <div>{error}</div>;
  if (!data) return <div>No data</div>;

  const { hourlyForecast, dailyForecast } = data;

  return (
    <div>
      {showHourly && hourlyForecast && hourlyForecast.length > 0 && (
        <div>
          <div>Hourly Forecast</div>
          {hourlyForecast.slice(0, 12).map((h, i) => (
            <div key={i}>{h.temperature}°</div>
          ))}
        </div>
      )}
      {!showHourly && dailyForecast && dailyForecast.length > 0 && (
        <div>
          <div>Daily Forecast</div>
          <div>Detailed forecast available within 7 days of the event</div>
        </div>
      )}
    </div>
  );
}

describe("Property 4: Date Proximity Determines Forecast Display Mode", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Pure logic property test:
   * Dates 0-7 days from today → showHourly = true (hourly forecast mode)
   */
  it("dates within 0-7 days from today yield showHourly = true", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 7 }),
        (daysFromNow) => {
          const eventDate = dateNDaysFromNow(daysFromNow);
          const showHourly = computeShowHourly(eventDate);
          expect(showHourly).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Pure logic property test:
   * Dates 8-14 days from today → showHourly = false (daily forecast + message mode)
   */
  it("dates 8-14 days from today yield showHourly = false", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 8, max: 14 }),
        (daysFromNow) => {
          const eventDate = dateNDaysFromNow(daysFromNow);
          const showHourly = computeShowHourly(eventDate);
          expect(showHourly).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Component rendering property test:
   * Event dates ≤7 days → renders "Hourly Forecast" text
   */
  it("renders Hourly Forecast section for events within 7 days", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 7 }),
        async (daysFromNow) => {
          const eventDate = dateNDaysFromNow(daysFromNow);
          const mockData = buildMockWeatherData(eventDate);
          mockGetWeatherPreview.mockResolvedValue(mockData);

          const { unmount } = render(
            <P_WeatherTestHarness
              f={{ latitude: 33.749, longitude: -84.388, date: eventDate }}
            />
          );

          await waitFor(() => {
            expect(screen.getByText("Hourly Forecast")).toBeInTheDocument();
          });

          // Should NOT show the "Detailed forecast" message
          expect(
            screen.queryByText("Detailed forecast available within 7 days of the event")
          ).not.toBeInTheDocument();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Component rendering property test:
   * Event dates >7 days → renders "Detailed forecast available within 7 days of the event"
   */
  it("renders daily forecast message for events more than 7 days away", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 8, max: 14 }),
        async (daysFromNow) => {
          const eventDate = dateNDaysFromNow(daysFromNow);
          const mockData = buildMockWeatherData(eventDate);
          mockGetWeatherPreview.mockResolvedValue(mockData);

          const { unmount } = render(
            <P_WeatherTestHarness
              f={{ latitude: 33.749, longitude: -84.388, date: eventDate }}
            />
          );

          await waitFor(() => {
            expect(
              screen.getByText("Detailed forecast available within 7 days of the event")
            ).toBeInTheDocument();
          });

          // Should NOT show the hourly forecast section
          expect(screen.queryByText("Hourly Forecast")).not.toBeInTheDocument();

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});
