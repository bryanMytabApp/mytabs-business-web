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

const NOT_PROVIDED = "Not Provided";

/**
 * Renders a single field row with label and value.
 * Shows "Not Provided" in italic if the value is null, undefined, or empty string.
 */
const FieldRow = ({ label, value }) => {
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <Box sx={fieldRowSx}>
      <Typography component="span" sx={labelSx}>
        {label}:
      </Typography>
      <Typography component="span" sx={isEmpty ? notProvidedSx : valueSx}>
        {isEmpty ? NOT_PROVIDED : value}
      </Typography>
    </Box>
  );
};

/**
 * EventInfoSection — displays event and organizer information.
 *
 * Props:
 *  - data (object): EventInfo object with fields:
 *      experienceId, eventId, name, eventName, eventDate, eventLocation,
 *      organizerName, organizerContact, sponsorName, sponsorOptedOut
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */
const EventInfoSection = ({ data }) => {
  if (!data) return null;

  const {
    eventName,
    eventDate,
    eventLocation,
    organizerName,
    organizerContact,
    sponsorName,
    sponsorOptedOut,
  } = data;

  // Sponsor logic: show name only if available AND not opted out
  const showSponsor = sponsorName && !sponsorOptedOut;

  return (
    <Box className="report-section" sx={sectionSx}>
      <Typography
        variant="h2"
        className="report-section-header"
        sx={sectionHeadingSx}
      >
        Event &amp; Organizer Information
      </Typography>

      <FieldRow label="Event Name" value={eventName} />
      <FieldRow label="Event Date" value={eventDate} />
      <FieldRow label="Event Location" value={eventLocation} />
      <FieldRow label="Organizer Name" value={organizerName} />
      <FieldRow label="Contact Information" value={organizerContact} />

      <Box sx={fieldRowSx}>
        <Typography component="span" sx={labelSx}>
          Sponsor:
        </Typography>
        <Typography
          component="span"
          sx={showSponsor ? valueSx : notProvidedSx}
        >
          {showSponsor ? sponsorName : NOT_PROVIDED}
        </Typography>
      </Box>
    </Box>
  );
};

export default EventInfoSection;
