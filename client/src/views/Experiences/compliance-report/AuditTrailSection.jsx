import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import {
  sectionSx,
  sectionHeadingSx,
  timelineEntrySx,
  timelineTimestampSx,
  timelineDescriptionSx,
} from "./reportStyles";

/**
 * Formats an ISO 8601 timestamp into a human-readable string with timezone.
 * Returns the raw string if parsing fails.
 */
const formatTimestamp = (timestamp) => {
  if (!timestamp) return "";
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return timestamp;
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    });
  } catch {
    return timestamp;
  }
};

/**
 * Maps action types to human-readable descriptions.
 */
const ACTION_LABELS = {
  DRAW_CLOSE_INITIATED: "Draw close initiated — entry window ended",
  ENTRIES_LOCKED: "Entries locked — no new entries accepted",
  RANDOMNESS_COMMITTED: "Randomness committed — NIST Beacon pulse selected",
  NIST_RANDOMNESS_RECEIVED: "NIST randomness received — beacon value retrieved",
  DRAW_SEED_CREATED: "Draw seed computed — entry list hashed with randomness",
  DRAW_COMPLETED: "Draw completed — winners selected",
  DRAW_FAILED: "Draw failed",
  STATE_TRANSITION: "State transition",
  LIFECYCLE_TRANSITION: "Lifecycle transition",
  PARTICIPATION: "New participation entry",
  ENTRY_INVALIDATED: "Entry invalidated",
  WINNER_CLAIMED: "Winner claimed prize",
  WINNER_FORFEITED: "Winner forfeited prize",
  ENTRY_WINDOW_OPENED: "Entry window opened — participants can now enter",
  ENTRY_WINDOW_CLOSED: "Entry window closed — no new entries accepted",
  DRAW_EXECUTED: "Draw executed — winner(s) selected",
};

/**
 * Builds a display description for a single audit event.
 * For STATE_TRANSITION events, appends the previous → new state if available.
 */
const buildDescription = (event) => {
  const actionType = event.actionType || event.eventType || event.type;
  const description = event.description || event.message;

  // If we have a direct description from the API, use it first
  if (description && description !== 'Event occurred') return description;

  // Use human-readable label if available
  let text = ACTION_LABELS[actionType] || description || actionType || "Event occurred";

  if (
    (actionType === "STATE_TRANSITION" || event.previousState) &&
    (event.previousState || event.newState)
  ) {
    const prev = event.previousState || "—";
    const next = event.newState || "—";
    text += ` (${prev} → ${next})`;
  }

  return text;
};

/**
 * Renders a single timeline entry with timestamp, actor, and description.
 */
const TimelineEntry = ({ event }) => {
  const { timestamp, actor } = event;
  const desc = buildDescription(event);

  return (
    <Box sx={timelineEntrySx}>
      <Typography component="span" sx={timelineTimestampSx}>
        {formatTimestamp(timestamp)}
      </Typography>
      <Box sx={timelineDescriptionSx}>
        <Typography component="span" sx={{ fontSize: "14px", color: "#000" }}>
          {desc}
        </Typography>
        {actor && (
          <Typography
            component="span"
            sx={{ fontSize: "13px", color: "#555", marginLeft: "8px" }}
          >
            — {actor}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

/**
 * AuditTrailSection — displays chronological timeline of all event changes,
 * state transitions, entry modifications, and admin actions.
 *
 * Props:
 *  - data (AuditEvent[]): Array of audit event objects with fields:
 *      timestamp, eventType, description, actor, previousState, newState, details
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6
 */
const AuditTrailSection = ({ data }) => {
  const isEmpty = !data || data.length === 0;

  // Sort entries chronologically (oldest first) by timestamp
  const sortedEntries = isEmpty
    ? []
    : [...data].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

  return (
    <Box className="report-section" sx={sectionSx}>
      <Typography
        variant="h2"
        className="report-section-header"
        sx={sectionHeadingSx}
      >
        Event Change History / Audit Trail
      </Typography>

      {isEmpty ? (
        <Typography sx={{ fontSize: "14px", color: "#666", fontStyle: "italic" }}>
          No activity recorded
        </Typography>
      ) : (
        <Box>
          {sortedEntries.map((event, index) => (
            <TimelineEntry key={`${event.timestamp}-${index}`} event={event} />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default AuditTrailSection;
