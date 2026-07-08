import { getWeatherPreview } from "./weatherPreviewService";

// Mock the http module
jest.mock("../utils/axios/http", () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

import http from "../utils/axios/http";

describe("getWeatherPreview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should call http.get with the correct URL", async () => {
    http.get.mockResolvedValue({ data: {} });

    await getWeatherPreview(33.749, -84.388, "2025-07-12T18:00:00Z");

    expect(http.get).toHaveBeenCalledWith(
      "/weather/preview",
      expect.any(Object)
    );
  });

  it("should pass latitude, longitude, and eventDate as params", async () => {
    http.get.mockResolvedValue({ data: {} });

    await getWeatherPreview(33.749, -84.388, "2025-07-12T18:00:00Z");

    expect(http.get).toHaveBeenCalledWith(
      "/weather/preview",
      expect.objectContaining({
        params: {
          latitude: 33.749,
          longitude: -84.388,
          eventDate: "2025-07-12T18:00:00Z",
        },
      })
    );
  });

  it("should pass the abort signal in the request config", async () => {
    http.get.mockResolvedValue({ data: {} });
    const controller = new AbortController();

    await getWeatherPreview(33.749, -84.388, "2025-07-12T18:00:00Z", controller.signal);

    expect(http.get).toHaveBeenCalledWith(
      "/weather/preview",
      expect.objectContaining({
        signal: controller.signal,
      })
    );
  });

  it("should set timeout to 15000ms", async () => {
    http.get.mockResolvedValue({ data: {} });

    await getWeatherPreview(33.749, -84.388, "2025-07-12T18:00:00Z");

    expect(http.get).toHaveBeenCalledWith(
      "/weather/preview",
      expect.objectContaining({
        timeout: 15000,
      })
    );
  });

  it("should pass signal as undefined when no signal is provided", async () => {
    http.get.mockResolvedValue({ data: {} });

    await getWeatherPreview(40.7128, -74.006, "2025-07-15T10:00:00Z");

    const callArgs = http.get.mock.calls[0][1];
    expect(callArgs.signal).toBeUndefined();
  });

  it("should return the response from http.get", async () => {
    const mockResponse = {
      data: {
        weatherStatus: "Normal",
        currentConditions: { temperature: 72 },
        safetyDisclaimer: "Weather info disclaimer...",
      },
    };
    http.get.mockResolvedValue(mockResponse);

    const result = await getWeatherPreview(33.749, -84.388, "2025-07-12T18:00:00Z");

    expect(result).toEqual(mockResponse);
  });

  it("should propagate errors from http.get", async () => {
    const networkError = new Error("Network Error");
    http.get.mockRejectedValue(networkError);

    await expect(
      getWeatherPreview(33.749, -84.388, "2025-07-12T18:00:00Z")
    ).rejects.toThrow("Network Error");
  });

  it("should propagate HTTP error responses", async () => {
    const httpError = {
      response: {
        status: 503,
        data: { error: "Weather data is temporarily unavailable" },
      },
    };
    http.get.mockRejectedValue(httpError);

    await expect(
      getWeatherPreview(33.749, -84.388, "2025-07-12T18:00:00Z")
    ).rejects.toEqual(httpError);
  });
});
