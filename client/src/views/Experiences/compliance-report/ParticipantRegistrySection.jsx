import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableHead from "@mui/material/TableHead";
import TableBody from "@mui/material/TableBody";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import {
  sectionSx,
  sectionHeadingSx,
  tableContainerSx,
  tableHeaderCellSx,
  tableCellSx,
  summaryCountSx,
} from "./reportStyles";

/**
 * Formats an ISO timestamp string into a human-readable format with timezone.
 * Returns null if the value is null/undefined/empty or invalid.
 */
function formatTimestamp(isoString) {
  if (!isoString) return null;
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      timeZoneName: "short",
    }).format(date);
  } catch {
    return null;
  }
}

/**
 * Formats consent status for display.
 * Shows "Yes" or "No" and appends the consent timestamp in parentheses if available.
 */
function formatConsent(consentStatus, consentTimestamp) {
  const status = consentStatus === "Yes" ? "Yes" : "No";
  if (consentTimestamp) {
    const formatted = formatTimestamp(consentTimestamp);
    if (formatted) {
      return `${status} (${formatted})`;
    }
  }
  return status;
}

/**
 * ParticipantRegistrySection — Displays the full participant registry table
 * with entry details sorted by Entry Code ascending.
 *
 * Props:
 *  - data (array): Array of Participant objects with fields:
 *      firstName, lastName, entryCode, enteredAt, channel,
 *      consentStatus, consentTimestamp, giftSelection
 *  - winners (array): Array of Winner objects with fields:
 *      entryCode, prizeAssigned
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 */
const ParticipantRegistrySection = ({ data, winners, drawings }) => {
  const participants = Array.isArray(data) ? data : [];
  const count = participants.length;

  // Build entryCode → prize lookup from winners
  const winnerPrizeMap = {};
  if (Array.isArray(winners)) {
    for (const w of winners) {
      if (w.entryCode) {
        winnerPrizeMap[w.entryCode] = w.prizeAssigned || w.prizeName || "Winner";
      }
    }
  }

  // Build entryId/entryCode → shuffled position lookup from drawing's shuffledEntryList
  const shuffledPositionMap = {};
  if (Array.isArray(drawings) && drawings.length > 0) {
    const latestDraw = drawings[0];
    let shuffledList = latestDraw?.shuffledEntryList || [];
    if (typeof shuffledList === "string") {
      try { shuffledList = JSON.parse(shuffledList); } catch { shuffledList = []; }
    }
    for (const entry of shuffledList) {
      if (entry.entryId) {
        shuffledPositionMap[entry.entryId] = entry.position;
      }
    }
    // Also map by entryCode from the winners list for cross-reference
    const allWinners = latestDraw?.winners || [];
    for (const w of allWinners) {
      if (w.entryCode && w.selectedFromShuffledPosition) {
        shuffledPositionMap[w.entryCode] = w.selectedFromShuffledPosition;
      }
    }
  }

  // Sort participants by entryCode ascending (lexicographic)
  const sorted = [...participants].sort((a, b) =>
    (a.entryCode || "").localeCompare(b.entryCode || "")
  );

  return (
    <Box className="report-section" sx={sectionSx}>
      <Typography
        variant="h2"
        className="report-section-header"
        sx={sectionHeadingSx}
      >
        Participant Registry
      </Typography>

      {/* Summary count — Req 6.5 */}
      <Typography sx={summaryCountSx}>
        Total Participants: {count}
      </Typography>

      {count === 0 ? (
        <Typography sx={{ fontSize: "14px", color: "#666", fontStyle: "italic" }}>
          No entries recorded
        </Typography>
      ) : (
        <Box sx={tableContainerSx}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={tableHeaderCellSx}>Draw Position</TableCell>
                <TableCell sx={tableHeaderCellSx}>First Name</TableCell>
                <TableCell sx={tableHeaderCellSx}>Last Name</TableCell>
                <TableCell sx={tableHeaderCellSx}>Entry Code</TableCell>
                <TableCell sx={tableHeaderCellSx}>Entry Timestamp</TableCell>
                <TableCell sx={tableHeaderCellSx}>Entry Channel</TableCell>
                <TableCell sx={tableHeaderCellSx}>Consent Status</TableCell>
                <TableCell sx={tableHeaderCellSx}>Prize Won</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((participant, idx) => {
                const prize = winnerPrizeMap[participant.entryCode] || null;
                const drawPosition = shuffledPositionMap[participant.entryId] || shuffledPositionMap[participant.entryCode] || participant.drawPosition || "—";
                return (
                  <TableRow key={participant.entryCode || idx}>
                    <TableCell sx={tableCellSx}>
                      {drawPosition}
                    </TableCell>
                    <TableCell sx={tableCellSx}>
                      {participant.firstName || "—"}
                    </TableCell>
                    <TableCell sx={tableCellSx}>
                      {participant.lastName || "—"}
                    </TableCell>
                    <TableCell sx={tableCellSx}>
                      {participant.entryCode || "—"}
                    </TableCell>
                    <TableCell sx={tableCellSx}>
                      {formatTimestamp(participant.enteredAt) || "—"}
                    </TableCell>
                    <TableCell sx={tableCellSx}>
                      {participant.channel || "—"}
                    </TableCell>
                    <TableCell sx={tableCellSx}>
                      {formatConsent(participant.consentStatus, participant.consentTimestamp)}
                    </TableCell>
                    <TableCell sx={tableCellSx}>
                      {prize || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
};

export default ParticipantRegistrySection;
