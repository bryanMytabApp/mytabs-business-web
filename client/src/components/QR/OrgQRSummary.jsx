import React from "react";
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
} from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import EventIcon from "@mui/icons-material/Event";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import FolderIcon from "@mui/icons-material/Folder";

/**
 * OrgQRSummary - Displays a summary of QR codes per business in an organization,
 * grouped by type (business, menu, event). Shows orgCode and each business's Business_Code.
 *
 * Props:
 * - organization (object): { orgCode, businesses: [{ businessCode, name, menuCodes?, eventCodes? }] }
 *
 * Requirements: 9.1, 9.4
 */
export function OrgQRSummary({ organization }) {
  if (!organization) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No organization data available.
        </Typography>
      </Box>
    );
  }

  const { orgCode, businesses = [] } = organization;

  // Calculate totals
  const totalBusinessQRs = businesses.filter((b) => b.businessCode).length;
  const totalMenuQRs = businesses.reduce(
    (sum, b) => sum + (b.menuCodes?.length || 0),
    0
  );
  const totalEventQRs = businesses.reduce(
    (sum, b) => sum + (b.eventCodes?.length || 0),
    0
  );
  const totalQRs = totalBusinessQRs + totalMenuQRs + totalEventQRs;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <QrCode2Icon />
        QR Code Summary
      </Typography>

      {/* Organization header */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <FolderIcon color="primary" />
          <Typography variant="subtitle1" fontWeight={600}>
            {organization.name || "Organization"}
          </Typography>
          <Chip
            label={orgCode || "ORG-..."}
            size="small"
            variant="outlined"
            color="primary"
            sx={{ fontFamily: "monospace" }}
          />
        </Box>

        {/* Totals row */}
        <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", mt: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <BusinessIcon fontSize="small" color="action" />
            <Typography variant="body2">
              {totalBusinessQRs} Business QR{totalBusinessQRs !== 1 ? "s" : ""}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <RestaurantMenuIcon fontSize="small" color="action" />
            <Typography variant="body2">
              {totalMenuQRs} Menu QR{totalMenuQRs !== 1 ? "s" : ""}
            </Typography>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <EventIcon fontSize="small" color="action" />
            <Typography variant="body2">
              {totalEventQRs} Event QR{totalEventQRs !== 1 ? "s" : ""}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            ({totalQRs} total)
          </Typography>
        </Box>
      </Paper>

      {/* Per-business breakdown */}
      {businesses.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No businesses linked to this organization.
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {businesses.map((biz, idx) => {
            const bizQRCount = biz.businessCode ? 1 : 0;
            const menuCount = biz.menuCodes?.length || 0;
            const eventCount = biz.eventCodes?.length || 0;

            return (
              <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 1,
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <BusinessIcon fontSize="small" color="action" />
                    <Typography variant="body2" fontWeight={600}>
                      {biz.name || "Unnamed Business"}
                    </Typography>
                    {biz.businessCode && (
                      <Chip
                        label={biz.businessCode}
                        size="small"
                        variant="outlined"
                        sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                      />
                    )}
                  </Box>

                  <Box sx={{ display: "flex", gap: 1.5, alignItems: "center" }}>
                    <Chip
                      icon={<BusinessIcon sx={{ fontSize: 14 }} />}
                      label={bizQRCount}
                      size="small"
                      color={bizQRCount > 0 ? "primary" : "default"}
                      variant="outlined"
                    />
                    <Chip
                      icon={<RestaurantMenuIcon sx={{ fontSize: 14 }} />}
                      label={menuCount}
                      size="small"
                      color={menuCount > 0 ? "success" : "default"}
                      variant="outlined"
                    />
                    <Chip
                      icon={<EventIcon sx={{ fontSize: 14 }} />}
                      label={eventCount}
                      size="small"
                      color={eventCount > 0 ? "secondary" : "default"}
                      variant="outlined"
                    />
                  </Box>
                </Box>
              </Paper>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

export default OrgQRSummary;
