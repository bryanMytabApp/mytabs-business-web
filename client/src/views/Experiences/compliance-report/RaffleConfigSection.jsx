import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import {
  sectionSx,
  sectionHeadingSx,
  fieldRowSx,
  labelSx,
  valueSx,
  notProvidedSx,
} from "./reportStyles";

/**
 * Formats an ISO timestamp string into a human-readable format with timezone.
 * Returns "Not Provided" if the value is null/undefined/empty.
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
 * Renders a single field row with label and value.
 * Displays "Not Provided" in italic when value is null/undefined/empty.
 */
const FieldRow = ({ label, value }) => (
  <Box sx={fieldRowSx}>
    <Typography component="span" sx={labelSx}>
      {label}:
    </Typography>
    {value != null && value !== "" ? (
      <Typography component="span" sx={valueSx}>
        {value}
      </Typography>
    ) : (
      <Typography component="span" sx={notProvidedSx}>
        Not Provided
      </Typography>
    )}
  </Box>
);

/**
 * RaffleConfigSection — Displays raffle configuration details including
 * name, description, prize details, entry windows, drawing schedule,
 * eligibility rules, nonprofit status, and compliance fields.
 *
 * Props:
 *  - data (object): RaffleConfig object with fields:
 *      name, description, prizeDescription, prizeValue,
 *      entryWindowStart, entryWindowEnd, drawingSchedule,
 *      winnersPerDrawing, eligibilityRules, charitablePurpose,
 *      nonprofitAuthorization, totalTicketsSold, prizeAwardDate
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8,
 *              15.1, 15.2, 15.3, 15.4, 15.5, 15.6
 */
const RaffleConfigSection = ({ data }) => {
  if (!data) return null;

  const {
    name,
    description,
    prizeDescription,
    prizeValue,
    entryWindowStart,
    entryWindowEnd,
    drawingSchedule,
    winnersPerDrawing,
    eligibilityRules,
    charitablePurpose,
    nonprofitAuthorization,
    totalTicketsSold,
    prizeAwardDate,
  } = data;

  return (
    <Box className="report-section" sx={sectionSx}>
      <Typography variant="h2" sx={sectionHeadingSx}>
        Raffle Configuration
      </Typography>

      {/* Basic raffle info — Req 5.2 */}
      <FieldRow label="Raffle Name" value={name} />
      <FieldRow label="Description" value={description} />

      {/* Prize details — Req 5.3, 15.2 */}
      <Box sx={fieldRowSx}>
        <Typography component="span" sx={labelSx}>
          Prize / Gift Details:
        </Typography>
        {prizeDescription ? (
          <Box component="span">
            {prizeDescription.split("\n").map((line, idx) => (
              <Typography key={idx} component="div" sx={valueSx}>
                {line}
              </Typography>
            ))}
          </Box>
        ) : (
          <Typography component="span" sx={notProvidedSx}>
            Not Provided
          </Typography>
        )}
      </Box>
      <FieldRow label="Perceived Value" value={prizeValue} />

      {/* Entry window — Req 5.4, 5.8 */}
      <FieldRow
        label="Entry Window Start"
        value={formatTimestamp(entryWindowStart)}
      />
      <FieldRow
        label="Entry Window End"
        value={formatTimestamp(entryWindowEnd)}
      />

      {/* Drawing schedule — Req 5.5 */}
      <FieldRow label="Drawing Schedule" value={drawingSchedule} />

      {/* Winners per drawing — Req 5.7 */}
      <FieldRow
        label="Winners Per Drawing"
        value={winnersPerDrawing != null ? String(winnersPerDrawing) : null}
      />

      {/* Eligibility rules — Req 5.6 */}
      <Box sx={fieldRowSx}>
        <Typography component="span" sx={labelSx}>
          Eligibility Rules:
        </Typography>
        {eligibilityRules && Array.isArray(eligibilityRules) && eligibilityRules.length > 0 ? (
          <Box component="ul" sx={{ margin: 0, paddingLeft: "20px" }}>
            {eligibilityRules.map((rule, idx) => (
              <li key={idx}>
                <Typography component="span" sx={valueSx}>
                  {rule}
                </Typography>
              </li>
            ))}
          </Box>
        ) : eligibilityRules && !Array.isArray(eligibilityRules) ? (
          <Typography component="span" sx={valueSx}>
            {eligibilityRules}
          </Typography>
        ) : (
          <Typography component="span" sx={notProvidedSx}>
            Not Provided
          </Typography>
        )}
      </Box>

      {/* Nonprofit status / raffle authorization — Req 15.1 */}
      <FieldRow
        label="Nonprofit Status / Raffle Authorization"
        value={nonprofitAuthorization}
      />

      {/* Total tickets/entries — Req 15.3 */}
      <FieldRow
        label="Total Tickets / Entries"
        value={totalTicketsSold != null ? String(totalTicketsSold) : null}
      />

      {/* Prize award date — Req 15.4, 5.8 */}
      <FieldRow
        label="Prize Award Date"
        value={formatTimestamp(prizeAwardDate)}
      />

      {/* No preferential treatment statement — Req 15.5 */}
      <Box sx={{ ...fieldRowSx, mt: 2 }}>
        <Typography sx={valueSx}>
          No ticket holder received preferential treatment in the selection
          process.
        </Typography>
      </Box>

      {/* Charitable purpose — Req 15.6 */}
      {charitablePurpose && (
        <FieldRow
          label="Charitable Purpose"
          value={charitablePurpose}
        />
      )}
    </Box>
  );
};

export default RaffleConfigSection;
