import React, { useState, useEffect } from "react";
import { Box, Typography, Paper, Divider } from "@mui/material";
import { OrgQRSummary, BulkQRDownload, BatchPDFGenerator } from "../../components/QR";

/**
 * OrgQRIntegration - Integrates OrgQRSummary and BulkQRDownload into the
 * organization dashboard view.
 *
 * Integration point: Add this component to OrganizationDashboard.jsx
 * below the existing panels (after the panelsRow div).
 *
 * Example integration in OrganizationDashboard.jsx:
 *   1. Import: import OrgQRIntegration from "./OrgQRIntegration";
 *   2. Place after the panelsRow closing div:
 *      <OrgQRIntegration
 *        organization={org}
 *        businesses={businesses}
 *      />
 *
 * Props:
 * - organization (object): The org object from OrganizationDashboard state
 * - businesses (array): The businesses array from OrganizationDashboard state
 *
 * Requirements: 9.1, 9.4
 */
export function OrgQRIntegration({ organization, businesses = [] }) {
  // Transform businesses into the format expected by QR components
  const orgData = {
    orgCode: organization?.orgCode || null,
    name: organization?.name || "Organization",
    businesses: businesses.map((biz) => ({
      businessCode: biz.businessCode || null,
      name: biz.name || "Unnamed Business",
      menuCodes: biz.menuCodes || [],
      eventCodes: biz.eventCodes || [],
    })),
  };

  // Transform for BulkQRDownload and BatchPDFGenerator
  const downloadBusinesses = businesses
    .filter((biz) => biz.businessCode)
    .map((biz) => ({
      businessCode: biz.businessCode,
      name: biz.name || "Unnamed Business",
    }));

  if (!organization) return null;

  return (
    <Box sx={{ mt: 3 }}>
      <Divider sx={{ mb: 3 }} />

      <Typography
        variant="h6"
        sx={{ mb: 2, fontFamily: "Outfit, sans-serif", fontWeight: 700 }}
      >
        QR Code Management
      </Typography>

      {/* QR Summary */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <OrgQRSummary organization={orgData} />
      </Paper>

      {/* Bulk Download */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <BulkQRDownload businesses={downloadBusinesses} />
      </Paper>

      {/* Batch PDF Generator */}
      <Paper variant="outlined" sx={{ mb: 3 }}>
        <BatchPDFGenerator businesses={downloadBusinesses} />
      </Paper>
    </Box>
  );
}

export default OrgQRIntegration;
