import { renderHook, act, waitFor } from "@testing-library/react";
import useReportData from "./useReportData";

// Mock react-router-dom
jest.mock("react-router-dom", () => ({
  useParams: () => ({ eventId: "evt-1", experienceId: "exp-1" }),
}));

// Mock experienceService
jest.mock("../../../services/experienceService", () => ({
  getInstance: jest.fn(),
  getEntries: jest.fn(),
  getDrawings: jest.fn(),
  getTimeline: jest.fn(),
  getDrawStatus: jest.fn(),
}));

const {
  getInstance,
  getEntries,
  getDrawings,
  getTimeline,
  getDrawStatus,
} = require("../../../services/experienceService");

describe("useReportData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: all services resolve with data
    getInstance.mockResolvedValue({ data: { data: { name: "Test Event" } } });
    getEntries.mockResolvedValue({ data: { data: [{ entryCode: "A1" }] } });
    getDrawings.mockResolvedValue({ data: { data: [{ id: "draw-1" }] } });
    getTimeline.mockResolvedValue({ data: { data: [{ timestamp: "2024-01-01" }] } });
    getDrawStatus.mockResolvedValue({ data: { data: { status: "completed" } } });
  });

  describe("parallel fetch initiation on mount", () => {
    it("calls all 5 service functions on mount", async () => {
      renderHook(() => useReportData());

      await waitFor(() => {
        expect(getInstance).toHaveBeenCalledTimes(2); // called for eventInfo + raffleConfig
        expect(getEntries).toHaveBeenCalledTimes(1);
        expect(getDrawings).toHaveBeenCalledTimes(1);
        expect(getTimeline).toHaveBeenCalledTimes(1);
        expect(getDrawStatus).toHaveBeenCalledTimes(1);
      });
    });

    it("passes eventId and experienceId to all service calls", async () => {
      renderHook(() => useReportData());

      await waitFor(() => {
        expect(getInstance).toHaveBeenCalledWith("evt-1", "exp-1");
        expect(getEntries).toHaveBeenCalledWith("evt-1", "exp-1");
        expect(getDrawings).toHaveBeenCalledWith("evt-1", "exp-1");
        expect(getTimeline).toHaveBeenCalledWith("evt-1", "exp-1");
        expect(getDrawStatus).toHaveBeenCalledWith("evt-1", "exp-1");
      });
    });
  });

  describe("per-section loading/error/data state transitions", () => {
    it("starts with loading=true for all sections", () => {
      // Make promises that never resolve so loading stays true
      getInstance.mockReturnValue(new Promise(() => {}));
      getEntries.mockReturnValue(new Promise(() => {}));
      getDrawings.mockReturnValue(new Promise(() => {}));
      getTimeline.mockReturnValue(new Promise(() => {}));
      getDrawStatus.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useReportData());

      expect(result.current.eventInfo.loading).toBe(true);
      expect(result.current.raffleConfig.loading).toBe(true);
      expect(result.current.participants.loading).toBe(true);
      expect(result.current.drawings.loading).toBe(true);
      expect(result.current.drawStatus.loading).toBe(true);
      expect(result.current.timeline.loading).toBe(true);
    });

    it("transitions loading to false and populates data on success", async () => {
      const { result } = renderHook(() => useReportData());

      await waitFor(() => {
        expect(result.current.eventInfo.loading).toBe(false);
        expect(result.current.participants.loading).toBe(false);
        expect(result.current.drawings.loading).toBe(false);
        expect(result.current.timeline.loading).toBe(false);
        expect(result.current.drawStatus.loading).toBe(false);
      });

      expect(result.current.eventInfo.data).toEqual({ name: "Test Event" });
      expect(result.current.participants.data).toEqual([{ entryCode: "A1" }]);
      expect(result.current.drawings.data).toEqual([{ id: "draw-1" }]);
      expect(result.current.timeline.data).toEqual([{ timestamp: "2024-01-01" }]);
      expect(result.current.drawStatus.data).toEqual({ status: "completed" });
    });

    it("sets error state when a fetch fails", async () => {
      getEntries.mockRejectedValue({
        response: { data: { message: "Network error" } },
      });

      const { result } = renderHook(() => useReportData());

      await waitFor(() => {
        expect(result.current.participants.loading).toBe(false);
        expect(result.current.participants.error).toBe("Network error");
        expect(result.current.participants.data).toBeNull();
      });
    });

    it("uses fallback error message when response lacks message", async () => {
      getDrawings.mockRejectedValue(new Error("timeout"));

      const { result } = renderHook(() => useReportData());

      await waitFor(() => {
        expect(result.current.drawings.loading).toBe(false);
        expect(result.current.drawings.error).toBe("Failed to load drawing results");
      });
    });

    it("sections resolve independently — one failure does not block others", async () => {
      getTimeline.mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useReportData());

      await waitFor(() => {
        expect(result.current.eventInfo.loading).toBe(false);
        expect(result.current.participants.loading).toBe(false);
        expect(result.current.drawings.loading).toBe(false);
        expect(result.current.timeline.loading).toBe(false);
      });

      // timeline failed
      expect(result.current.timeline.error).toBe("Failed to load audit timeline");
      // others succeeded
      expect(result.current.eventInfo.data).toEqual({ name: "Test Event" });
      expect(result.current.participants.data).toEqual([{ entryCode: "A1" }]);
      expect(result.current.drawings.data).toEqual([{ id: "draw-1" }]);
    });
  });

  describe("retry function re-fetches only the specified section", () => {
    it("retry('participants') only re-calls getEntries", async () => {
      getEntries.mockRejectedValueOnce(new Error("fail"));

      const { result } = renderHook(() => useReportData());

      await waitFor(() => {
        expect(result.current.participants.error).toBe("Failed to load participant entries");
      });

      // Clear mocks to track new calls
      jest.clearAllMocks();
      getInstance.mockResolvedValue({ data: { data: { name: "Test Event" } } });
      getEntries.mockResolvedValue({ data: { data: [{ entryCode: "B2" }] } });
      getDrawings.mockResolvedValue({ data: { data: [{ id: "draw-1" }] } });
      getTimeline.mockResolvedValue({ data: { data: [] } });
      getDrawStatus.mockResolvedValue({ data: { data: { status: "completed" } } });

      act(() => {
        result.current.retry("participants");
      });

      await waitFor(() => {
        expect(result.current.participants.loading).toBe(false);
        expect(result.current.participants.data).toEqual([{ entryCode: "B2" }]);
      });

      expect(getEntries).toHaveBeenCalledTimes(1);
      expect(getInstance).not.toHaveBeenCalled();
      expect(getDrawings).not.toHaveBeenCalled();
      expect(getTimeline).not.toHaveBeenCalled();
      expect(getDrawStatus).not.toHaveBeenCalled();
    });

    it("retry('timeline') only re-calls getTimeline", async () => {
      getTimeline.mockRejectedValueOnce(new Error("fail"));

      const { result } = renderHook(() => useReportData());

      await waitFor(() => {
        expect(result.current.timeline.error).toBe("Failed to load audit timeline");
      });

      jest.clearAllMocks();
      getInstance.mockResolvedValue({ data: { data: { name: "Test Event" } } });
      getEntries.mockResolvedValue({ data: { data: [] } });
      getDrawings.mockResolvedValue({ data: { data: [] } });
      getTimeline.mockResolvedValue({ data: { data: [{ timestamp: "2024-02-01" }] } });
      getDrawStatus.mockResolvedValue({ data: { data: {} } });

      act(() => {
        result.current.retry("timeline");
      });

      await waitFor(() => {
        expect(result.current.timeline.loading).toBe(false);
        expect(result.current.timeline.data).toEqual([{ timestamp: "2024-02-01" }]);
        expect(result.current.timeline.error).toBeNull();
      });

      expect(getTimeline).toHaveBeenCalledTimes(1);
      expect(getInstance).not.toHaveBeenCalled();
      expect(getEntries).not.toHaveBeenCalled();
      expect(getDrawings).not.toHaveBeenCalled();
      expect(getDrawStatus).not.toHaveBeenCalled();
    });

    it("retry with an invalid section name does nothing", async () => {
      const { result } = renderHook(() => useReportData());

      await waitFor(() => {
        expect(result.current.eventInfo.loading).toBe(false);
      });

      jest.clearAllMocks();
      getInstance.mockResolvedValue({ data: { data: { name: "Test Event" } } });
      getEntries.mockResolvedValue({ data: { data: [] } });
      getDrawings.mockResolvedValue({ data: { data: [] } });
      getTimeline.mockResolvedValue({ data: { data: [] } });
      getDrawStatus.mockResolvedValue({ data: { data: {} } });

      act(() => {
        result.current.retry("invalidSection");
      });

      expect(getInstance).not.toHaveBeenCalled();
      expect(getEntries).not.toHaveBeenCalled();
      expect(getDrawings).not.toHaveBeenCalled();
      expect(getTimeline).not.toHaveBeenCalled();
      expect(getDrawStatus).not.toHaveBeenCalled();
    });
  });

  describe("hasCompletedDraw", () => {
    it("returns false when drawings.data is an empty array", async () => {
      getDrawings.mockResolvedValue({ data: { data: [] } });

      const { result } = renderHook(() => useReportData());

      await waitFor(() => {
        expect(result.current.drawings.loading).toBe(false);
      });

      expect(result.current.hasCompletedDraw).toBe(false);
    });

    it("returns false when drawings.data is null (still loading or error)", () => {
      getDrawings.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useReportData());

      // While loading, data is null
      expect(result.current.drawings.data).toBeNull();
      expect(result.current.hasCompletedDraw).toBe(false);
    });

    it("returns true when drawings.data contains at least one drawing", async () => {
      getDrawings.mockResolvedValue({ data: { data: [{ id: "draw-1" }] } });

      const { result } = renderHook(() => useReportData());

      await waitFor(() => {
        expect(result.current.drawings.loading).toBe(false);
      });

      expect(result.current.hasCompletedDraw).toBe(true);
    });
  });
});
