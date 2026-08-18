import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import {
  sectionSx,
  sectionHeadingSx,
  tableContainerSx,
  tableHeaderCellSx,
  tableCellSx,
} from "./reportStyles";

/**
 * Maps a raw claim status to one of the three valid display values.
 * Returns "Pending" as the default for any unrecognized value.
 */
function normalizeClaimStatus(status) {
  if (!status) return "Pending";
  const lower = String(status).toLowerCase().trim();
  if (lower === "claimed") return "Claimed";
  if (lower === "forfeited") return "Forfeited";
  return "Pending";
}

/**
 * Formats an ISO timestamp string into a human-readable format with timezone.
 * Returns "—" if the value is null/undefined/empty or invalid.
 */
function formatTimestamp(isoString) {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "—";
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
    return "—";
  }
}

/**
 * WinnerDetailsSection — Displays winner information in a table format.
 *
 * Props:
 *  - data (array): Array of Winner objects with fields:
 *      fullName, entryCode, position, prizeAssigned, claimStatus, selectionTimestamp
 *
 * Behavior:
 *  - Sorts winners by position number ascending (numeric sort)
 *  - Claim status normalized to exactly "Claimed", "Pending", or "Forfeited"
 *  - Shows "No winners selected" when data is empty or null
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */
const WinnerDetailsSection = ({ data }) => {
  const hasWinners = Array.isArray(data) && data.length > 0;

  // Sort winners by position ascending (numeric)
  const sortedWinners = hasWinners
    ? [...data].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    : [];

  return (
    <Box className="report-section" sx={sectionSx}>
      <Typography
        variant="h2"
        className="report-section-header"
        sx={sectionHeadingSx}
      >
        Winner Details
      </Typography>

      {!hasWinners ? (
        <Typography sx={{ fontSize: "14px", color: "#666", fontStyle: "italic" }}>
          No winners selected
        </Typography>
      ) : (
        <TableContainer sx={tableContainerSx}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={tableHeaderCellSx}>Position</TableCell>
                <TableCell sx={tableHeaderCellSx}>Full Name</TableCell>
                <TableCell sx={tableHeaderCellSx}>Entry Code</TableCell>
                <TableCell sx={tableHeaderCellSx}>Prize Assigned</TableCell>
                <TableCell sx={tableHeaderCellSx}>Claim Status</TableCell>
                <TableCell sx={tableHeaderCellSx}>Selection Timestamp</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedWinners.map((winner, idx) => (
                <TableRow key={winner.entryCode || idx}>
                  <TableCell sx={tableCellSx}>{winner.position}</TableCell>
                  <TableCell sx={tableCellSx}>{winner.fullName}</TableCell>
                  <TableCell sx={tableCellSx}>{winner.entryCode}</TableCell>
                  <TableCell sx={tableCellSx}>{winner.prizeAssigned}</TableCell>
                  <TableCell sx={tableCellSx}>
                    {normalizeClaimStatus(winner.claimStatus)}
                  </TableCell>
                  <TableCell sx={tableCellSx}>
                    {formatTimestamp(winner.selectionTimestamp)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Verification Method — how to independently validate the winner */}
      {hasWinners && (
        <Box sx={{ mt: 3, p: 2, backgroundColor: "#f8f9fa", borderRadius: "8px", border: "1px solid #e0e0e0" }}>
          <Typography sx={{ fontSize: "14px", fontWeight: 700, color: "#1D1B20", mb: 1 }}>
            How to Verify This Result
          </Typography>
          <Typography sx={{ fontSize: "13px", color: "#333", lineHeight: 1.7 }}>
            The winning participant at position #{sortedWinners[0]?.position} was selected using publicly verifiable inputs.
            To independently confirm the result:
          </Typography>
          <Box component="ol" sx={{ fontSize: "13px", color: "#333", lineHeight: 1.8, pl: 3, mt: 1 }}>
            <li>
              <strong>Verify the Entry List Hash:</strong> Sort all participant entry codes
              alphabetically, concatenate them (newline-separated), and compute SHA-256. The result must match the Entry List
              Hash in the Cryptographic Proof section.
            </li>
            <li>
              <strong>Verify the NIST Beacon Value:</strong> Visit the NIST Randomness Beacon at the pulse
              link above and confirm the Output Value matches. This value was published by NIST after entries
              were locked — neither the organizer nor the platform could have known it in advance.
            </li>
            <li>
              <strong>Verify the Draw Seed:</strong> The Draw Seed is computed as{" "}
              <code style={{ fontSize: "12px", backgroundColor: "#e8e8e8", padding: "2px 4px", borderRadius: "3px" }}>
                SHA-256(canonical JSON of protocol inputs)
              </code>.{" "}
              Recompute this using the values above and confirm it matches.
            </li>
            <li>
              <strong>Verify the Shuffled Order:</strong> Derive the shuffle seed as{" "}
              <code style={{ fontSize: "12px", backgroundColor: "#e8e8e8", padding: "2px 4px", borderRadius: "3px" }}>
                SHA-256(drawSeed + ":shuffle")
              </code>{" "}
              and apply the deterministic cryptographic shuffle to the sorted entry list. The resulting shuffled list hash must match.
            </li>
            <li>
              <strong>Verify the Winning Participant:</strong> Apply the cryptographic selection method
              using the draw seed against the total entry count on the shuffled list.
              The participant at position #{sortedWinners[0]?.position} in the shuffled list is the deterministic result — anyone with the
              same inputs will arrive at the same winning participant.
            </li>
          </Box>
          <Typography sx={{ fontSize: "12px", color: "#666", mt: 1, fontStyle: "italic" }}>
            All inputs are publicly available. No secret keys or private data were used in participant selection.
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default WinnerDetailsSection;
