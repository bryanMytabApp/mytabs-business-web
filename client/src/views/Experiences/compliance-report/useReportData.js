import { useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  getInstance,
  getEntries,
  getDrawings,
  getTimeline,
} from "../../../services/experienceService";
import { getEvent } from "../../../services/eventService";
import { parseJwt } from "../../../utils/common";

/**
 * Initial state for each data section — used to reset and initialize.
 */
const createSectionState = () => ({
  data: null,
  loading: true,
  error: null,
});

/**
 * useReportData — Custom hook for parallel data fetching across all
 * Draw Compliance Report sections. Each section fetches independently
 * to enable progressive rendering.
 *
 * Returns per-section { data, loading, error } state objects,
 * a `hasCompletedDraw` derived boolean, and a `retry(section)` function.
 */
const useReportData = () => {
  const { eventId, experienceId } = useParams();

  const [eventInfo, setEventInfo] = useState(createSectionState());
  const [raffleConfig, setRaffleConfig] = useState(createSectionState());
  const [participants, setParticipants] = useState(createSectionState());
  const [drawings, setDrawings] = useState(createSectionState());
  const [drawStatus, setDrawStatus] = useState(createSectionState());
  const [timeline, setTimeline] = useState(createSectionState());

  // ─── Fetch functions for each section ──────────────────────────────────────

  const fetchEventInfo = useCallback(async () => {
    setEventInfo({ data: null, loading: true, error: null });
    try {
      const res = await getInstance(eventId, experienceId);
      const instance = res.data?.data || res.data;

      // Also fetch the parent event for name, date, location, organizer
      let eventData = {};
      try {
        const token = localStorage.getItem("idToken");
        const userId = parseJwt(token);
        if (userId) {
          const eventRes = await getEvent(userId, eventId);
          eventData = eventRes.data?.data || eventRes.data || {};
        }
      } catch (e) {
        // If event fetch fails, continue with what we have from instance
        console.warn("Could not fetch parent event data:", e.message);
      }

      // Merge: event-level fields + instance-level fields
      const merged = {
        ...instance,
        eventName: eventData.name || eventData.title || instance?.eventName,
        eventDate: eventData.startDate
          ? new Intl.DateTimeFormat("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZoneName: "short",
            }).format(new Date(eventData.startDate))
          : instance?.eventDate,
        eventLocation: eventData.address1
          ? [eventData.address1, eventData.city, eventData.state].filter(Boolean).join(", ")
          : instance?.eventLocation,
        organizerName: instance?.config?.compliance?.sponsorLegalName || eventData.organizerName,
        organizerContact: instance?.config?.compliance?.supportContact || eventData.email,
        sponsorName: instance?.config?.compliance?.sponsorLegalName || eventData.sponsorName,
      };

      setEventInfo({ data: merged, loading: false, error: null });
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to load event information";
      setEventInfo({ data: null, loading: false, error: message });
    }
  }, [eventId, experienceId]);

  const fetchRaffleConfig = useCallback(async () => {
    setRaffleConfig({ data: null, loading: true, error: null });
    try {
      const res = await getInstance(eventId, experienceId);
      const instance = res.data?.data || res.data;
      // Raffle config is derived from the instance config field
      const config = instance?.config || {};

      // Transform config fields to match what RaffleConfigSection expects
      const prizes = config.prizes || [];
      const primaryPrize = prizes[0] || {};

      // Format each prize as "Name ($Value)" on separate lines
      const prizeDetails = prizes
        .map((p) => {
          const val = p.value ? ` ($${parseFloat(p.value).toLocaleString()})` : "";
          return `${p.name || "Prize"}${val}`;
        })
        .join("\n");

      const totalValue = prizes.reduce((sum, p) => sum + (parseFloat(p.value) || 0), 0);

      const schedules = config.drawingSchedules || [];
      const drawingScheduleStr = schedules
        .map((s) => {
          try {
            const d = new Date(s.time);
            return new Intl.DateTimeFormat("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
              timeZoneName: "short",
            }).format(d);
          } catch {
            return s.time;
          }
        })
        .join("; ");
      const totalWinners = schedules.reduce((sum, s) => sum + (s.winners || 0), 0);

      // Fetch total entries count and prize award date
      let totalEntries = null;
      let prizeAwardDate = null;
      try {
        const entriesRes = await getEntries(eventId, experienceId, { limit: 200 });
        const entriesData = entriesRes.data?.data || entriesRes.data?.items || entriesRes.data || [];
        totalEntries = Array.isArray(entriesData) ? entriesData.length : null;
      } catch (e) { /* ignore */ }

      try {
        const drawingsRes = await getDrawings(eventId, experienceId);
        const drawingsData = drawingsRes.data?.data || drawingsRes.data?.items || drawingsRes.data || [];
        const drawingsArr = Array.isArray(drawingsData) ? drawingsData : [];
        if (drawingsArr.length > 0) {
          prizeAwardDate = drawingsArr[0].timestamp || null;
        }
      } catch (e) { /* ignore */ }

      const transformed = {
        name: instance?.name || config.name || null,
        description: primaryPrize.description || config.description || null,
        prizeDescription: prizeDetails || null,
        prizeValue: totalValue > 0 ? `$${totalValue.toLocaleString()}` : null,
        entryWindowStart: config.entryWindowStart,
        entryWindowEnd: config.entryWindowEnd,
        drawingSchedule: drawingScheduleStr || null,
        winnersPerDrawing: totalWinners || null,
        eligibilityRules: config.eligibilityRules?.length > 0
          ? config.eligibilityRules
          : config.entryModel
            ? [`Entry model: ${config.entryModel}`]
            : null,
        charitablePurpose: config.compliance?.charitablePurpose || null,
        nonprofitAuthorization: config.compliance?.jurisdictions?.join(", ") || null,
        totalTicketsSold: totalEntries,
        prizeAwardDate,
      };

      setRaffleConfig({ data: transformed, loading: false, error: null });
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to load raffle configuration";
      setRaffleConfig({ data: null, loading: false, error: message });
    }
  }, [eventId, experienceId]);

  const fetchParticipants = useCallback(async () => {
    setParticipants({ data: null, loading: true, error: null });
    try {
      const res = await getEntries(eventId, experienceId, { limit: 200 });
      const entries = res.data?.data || res.data?.items || res.data || [];
      const entriesArr = Array.isArray(entries) ? entries : [];

      // Fetch drawings to get winner positions
      let winnersMap = {};
      try {
        const drawingsRes = await getDrawings(eventId, experienceId);
        const drawingsData = drawingsRes.data?.data || drawingsRes.data?.items || drawingsRes.data || [];
        const drawingsArr = Array.isArray(drawingsData) ? drawingsData : [];
        for (const drawing of drawingsArr) {
          for (const w of drawing.winners || []) {
            const key = w.entryCode || w.userId || w.entryId;
            if (key) {
              winnersMap[key] = w.winningPosition || w.position || "Winner";
            }
          }
        }
      } catch (e) { /* ignore - winners enrichment is optional */ }

      // Sort entries by entry code alphabetically (same order used for draw)
      // to assign each participant their draw position number
      const sortedByCode = [...entriesArr].sort((a, b) =>
        (a.entryCode || "").localeCompare(b.entryCode || "")
      );

      // Transform entries to match ParticipantRegistrySection expected fields
      const transformed = sortedByCode.map((entry, idx) => {
        // Handle both schemas: some entries have firstName/lastName,
        // others have attendeeName as a single field
        let firstName = entry.firstName || null;
        let lastName = entry.lastName || null;

        if (!firstName && !lastName && entry.attendeeName) {
          const nameParts = entry.attendeeName.trim().split(/\s+/);
          firstName = nameParts[0] || null;
          lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;
        }

        // Assign draw position (1-indexed)
        const position = idx + 1;

        // Check if this entry is a winner
        const winPosition = winnersMap[entry.entryCode] || winnersMap[entry.userId] || winnersMap[entry.entryId];
        const giftSelection = winPosition
          ? `#${position} — 🏆 Winner`
          : `#${position}`;

        return {
          firstName,
          lastName,
          entryCode: entry.entryCode || entry.SK?.replace("ENTRY#", "") || null,
          entryId: entry.entryId || entry.SK?.replace("ENTRY#", "") || null,
          enteredAt: entry.enteredAt || entry.entryTimestamp || entry.createdAt || null,
          channel: entry.channel || null,
          consentStatus: entry.consentStatus || ((firstName || entry.attendeeName) ? "Yes" : "No"),
          consentTimestamp: entry.consentTimestamp || entry.enteredAt || entry.entryTimestamp || null,
          giftSelection,
        };
      });

      setParticipants({ data: transformed, loading: false, error: null });
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to load participant entries";
      setParticipants({ data: null, loading: false, error: message });
    }
  }, [eventId, experienceId]);

  const fetchDrawings = useCallback(async () => {
    setDrawings({ data: null, loading: true, error: null });
    try {
      const res = await getDrawings(eventId, experienceId);
      const data = res.data?.data || res.data?.items || res.data || [];
      setDrawings({
        data: Array.isArray(data) ? data : [],
        loading: false,
        error: null,
      });
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to load drawing results";
      setDrawings({ data: null, loading: false, error: message });
    }
  }, [eventId, experienceId]);

  const fetchDrawStatus = useCallback(async () => {
    setDrawStatus({ data: null, loading: true, error: null });
    try {
      // Draw status / cryptographic proof is embedded in the drawing metadata
      const res = await getDrawings(eventId, experienceId);
      const drawingsData = res.data?.data || res.data?.items || res.data || [];
      const drawingsArr = Array.isArray(drawingsData) ? drawingsData : [];

      // Extract proof from the most recent drawing's metadata
      const latestDraw = drawingsArr[0];
      const metadata = latestDraw?.metadata || {};

      // Also fetch timeline for additional audit data (entryListHash, nistOutputValue)
      let entryListHash = null;
      let nistOutputValue = null;
      try {
        const timelineRes = await getTimeline(eventId, experienceId);
        const timelineData = timelineRes.data?.data || timelineRes.data?.items || timelineRes.data || [];
        const timelineArr = Array.isArray(timelineData) ? timelineData : [];

        for (const evt of timelineArr) {
          if (evt.actionType === "DRAW_SEED_CREATED" || evt.eventType === "DRAW_SEED_CREATED") {
            const details = evt.metadata || evt.details || {};
            entryListHash = entryListHash || details.entryListHash || null;
          }
          if (evt.actionType === "NIST_RANDOMNESS_RECEIVED" || evt.eventType === "NIST_RANDOMNESS_RECEIVED") {
            const details = evt.metadata || evt.details || {};
            nistOutputValue = nistOutputValue || details.outputValue || null;
          }
          if (evt.actionType === "RANDOMNESS_COMMITTED" || evt.eventType === "RANDOMNESS_COMMITTED") {
            const details = evt.metadata || evt.details || {};
            nistOutputValue = nistOutputValue || details.outputValue || null;
          }
        }
      } catch (e) {
        console.warn("Could not fetch timeline for crypto proof enrichment:", e.message);
      }

      // If we have the pulse index but no output value, fetch directly from NIST Beacon API
      const pulseIndex = metadata.nistPulseIndex;
      if (!nistOutputValue && pulseIndex) {
        try {
          const nistRes = await fetch(
            `https://beacon.nist.gov/beacon/2.0/chain/2/pulse/${pulseIndex}`
          );
          if (nistRes.ok) {
            const nistData = await nistRes.json();
            nistOutputValue = nistData.pulse?.outputValue || null;
          }
        } catch (e) {
          console.warn("Could not fetch NIST beacon output value:", e.message);
        }
      }

      const proofData = {
        protocolVersion: metadata.protocol || "tabs-raffle-v1",
        drawSeed: metadata.drawSeed || latestDraw?.seed || null,
        shuffleSeed: metadata.shuffleSeed || latestDraw?.shuffleSeed || null,
        shuffledListHash: metadata.shuffledListHash || latestDraw?.shuffledListHash || null,
        receiptHash: metadata.receiptHash || latestDraw?.receiptHash || null,
        nistPulseIndex: metadata.nistPulseIndex || null,
        nistOutputValue: nistOutputValue || metadata.nistOutputValue || null,
        entryListHash: entryListHash || metadata.entryListHash || latestDraw?.entryListHash || null,
      };

      setDrawStatus({ data: proofData, loading: false, error: null });
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to load draw status";
      setDrawStatus({ data: null, loading: false, error: message });
    }
  }, [eventId, experienceId]);

  const fetchTimeline = useCallback(async () => {
    setTimeline({ data: null, loading: true, error: null });
    try {
      const res = await getTimeline(eventId, experienceId);
      const data = res.data?.data || res.data?.items || res.data || [];
      setTimeline({
        data: Array.isArray(data) ? data : [],
        loading: false,
        error: null,
      });
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to load audit timeline";
      setTimeline({ data: null, loading: false, error: message });
    }
  }, [eventId, experienceId]);

  // ─── Parallel fetch on mount ───────────────────────────────────────────────

  useEffect(() => {
    fetchEventInfo();
    fetchRaffleConfig();
    fetchParticipants();
    fetchDrawings();
    fetchDrawStatus();
    fetchTimeline();
  }, [
    fetchEventInfo,
    fetchRaffleConfig,
    fetchParticipants,
    fetchDrawings,
    fetchDrawStatus,
    fetchTimeline,
  ]);

  // ─── Derived state ─────────────────────────────────────────────────────────

  /**
   * hasCompletedDraw — true if at least one drawing exists in the fetched data.
   * Used to gate the report rendering (show empty state if no draws).
   */
  const hasCompletedDraw =
    Array.isArray(drawings.data) && drawings.data.length > 0;

  // ─── Per-section retry ─────────────────────────────────────────────────────

  const sectionFetchMap = {
    eventInfo: fetchEventInfo,
    raffleConfig: fetchRaffleConfig,
    participants: fetchParticipants,
    drawings: fetchDrawings,
    drawStatus: fetchDrawStatus,
    timeline: fetchTimeline,
  };

  /**
   * retry — Re-fetches data for a specific section by name.
   * @param {string} section - One of: 'eventInfo', 'raffleConfig', 'participants',
   *   'drawings', 'drawStatus', 'timeline'
   */
  const retry = useCallback(
    (section) => {
      const fetchFn = sectionFetchMap[section];
      if (fetchFn) {
        fetchFn();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      fetchEventInfo,
      fetchRaffleConfig,
      fetchParticipants,
      fetchDrawings,
      fetchDrawStatus,
      fetchTimeline,
    ]
  );

  return {
    eventInfo,
    raffleConfig,
    participants,
    drawings,
    drawStatus,
    timeline,
    hasCompletedDraw,
    retry,
  };
};

export default useReportData;
