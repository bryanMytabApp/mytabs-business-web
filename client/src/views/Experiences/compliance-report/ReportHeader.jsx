import React from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { headerActionsSx, backNavSx, actionButtonsSx } from "./reportStyles";

/**
 * Report header with back navigation and export action buttons.
 *
 * Props:
 *  - onPrint (function): triggers window.print() for PDF export
 *  - onExport (function): triggers JSON data export
 *  - allLoaded (boolean): when false, disables the Export JSON button
 *  - eventId (string): event ID for back navigation
 *  - experienceId (string): experience ID for back navigation
 */
const ReportHeader = ({ onPrint, onExport, allLoaded, eventId, experienceId }) => {
  const navigate = useNavigate();

  const handleBack = () => {
    navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/drawings`);
  };

  return (
    <Box sx={headerActionsSx} className="report-header-actions">
      <Box sx={backNavSx} className="report-back-nav">
        <IconButton
          onClick={handleBack}
          aria-label="Back to Drawing History"
          size="medium"
        >
          <ArrowBackIcon />
        </IconButton>
      </Box>

      <Box sx={actionButtonsSx}>
        <Button
          variant="outlined"
          onClick={onPrint}
          disabled={!allLoaded}
          size="small"
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Download PDF
        </Button>
        <Button
          variant="contained"
          onClick={onExport}
          disabled={!allLoaded}
          size="small"
          sx={{ textTransform: "none", fontWeight: 600 }}
        >
          Export Data (JSON)
        </Button>
      </Box>
    </Box>
  );
};

export default ReportHeader;
