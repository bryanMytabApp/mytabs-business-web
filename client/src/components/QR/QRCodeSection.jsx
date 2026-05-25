import React, { useState, useMemo } from "react";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
} from "@mui/material";
import BusinessIcon from "@mui/icons-material/Business";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import EventIcon from "@mui/icons-material/Event";
import QRCode from "react-qr-code";
import { QRDownloadButton } from "./QRDownloadButton";

/**
 * QRCodeSection - Aggregated view of all QR codes for a business.
 * Shows business QR, menu QRs, and event QRs with tab-based switching.
 *
 * Props:
 * - business (object): Business object with:
 *   - businessCode (string): The business's public code
 *   - name (string): Business name
 *   - menus (array, optional): Array of { url, label, menuCode }
 *   - events (array, optional): Array of { eventId, name, eventCode, date }
 *
 * Requirements: 4.6, 4.9
 */

function QRPreviewCard({ qrUrl, code, label, subtitle }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1.5,
        p: 2,
      }}
    >
      {label && (
        <Typography variant="subtitle1" fontWeight={600}>
          {label}
        </Typography>
      )}

      <Box
        sx={{
          p: 2,
          backgroundColor: "#ffffff",
          borderRadius: 2,
          border: "1px solid #e0e0e0",
          display: "inline-flex",
        }}
      >
        <QRCode value={qrUrl} size={200} level="H" />
      </Box>

      {code && (
        <Typography
          variant="body2"
          sx={{ fontFamily: "monospace", color: "text.secondary" }}
        >
          {code}
        </Typography>
      )}

      <Typography
        variant="body2"
        sx={{
          wordBreak: "break-all",
          textAlign: "center",
          color: "text.primary",
          maxWidth: "100%",
        }}
      >
        {qrUrl}
      </Typography>

      {subtitle && (
        <Typography variant="caption" color="text.secondary">
          {subtitle}
        </Typography>
      )}

      <QRDownloadButton qrUrl={qrUrl} publicCode={code} entityName={label} />
    </Box>
  );
}

export function QRCodeSection({ business }) {
  const [activeTab, setActiveTab] = useState(0);

  const businessQrUrl = business?.businessCode
    ? `https://keeptabs.app/b/${business.businessCode}`
    : null;

  const menuQRs = useMemo(() => {
    if (!business?.menus) return [];
    return business.menus
      .filter((m) => m.menuCode)
      .map((m) => ({
        qrUrl: `https://keeptabs.app/m/${m.menuCode}`,
        code: m.menuCode,
        label: m.label || "Menu",
        subtitle: m.url,
      }));
  }, [business?.menus]);

  const eventQRs = useMemo(() => {
    if (!business?.events) return [];
    return business.events
      .filter((e) => e.eventCode)
      .map((e) => ({
        qrUrl: `https://keeptabs.app/e/${e.eventCode}`,
        code: e.eventCode,
        label: e.name || "Event",
        subtitle: e.date
          ? new Date(e.date).toLocaleDateString()
          : undefined,
      }));
  }, [business?.events]);

  const hasMenus = menuQRs.length > 0;
  const hasEvents = eventQRs.length > 0;

  const handleTabChange = (_, newValue) => {
    setActiveTab(newValue);
  };

  if (!business?.businessCode) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No public code assigned. Generate a public code to view QR codes.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        QR Codes
      </Typography>

      <Paper variant="outlined" sx={{ mb: 2 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: "divider" }}
        >
          <Tab
            icon={<BusinessIcon />}
            iconPosition="start"
            label="Business"
            sx={{ textTransform: "none", minHeight: 48 }}
          />
          {hasMenus && (
            <Tab
              icon={<RestaurantMenuIcon />}
              iconPosition="start"
              label={`Menus (${menuQRs.length})`}
              sx={{ textTransform: "none", minHeight: 48 }}
            />
          )}
          {hasEvents && (
            <Tab
              icon={<EventIcon />}
              iconPosition="start"
              label={`Events (${eventQRs.length})`}
              sx={{ textTransform: "none", minHeight: 48 }}
            />
          )}
        </Tabs>

        <Box sx={{ p: 2 }}>
          {/* Business QR Tab */}
          {activeTab === 0 && businessQrUrl && (
            <QRPreviewCard
              qrUrl={businessQrUrl}
              code={business.businessCode}
              label={business.name}
            />
          )}

          {/* Menu QRs Tab */}
          {activeTab === 1 && hasMenus && (
            <Box
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 3,
              }}
            >
              {menuQRs.map((menu, idx) => (
                <QRPreviewCard
                  key={idx}
                  qrUrl={menu.qrUrl}
                  code={menu.code}
                  label={menu.label}
                  subtitle={menu.subtitle}
                />
              ))}
            </Box>
          )}

          {/* Event QRs Tab */}
          {((activeTab === 2 && hasMenus) ||
            (activeTab === 1 && !hasMenus)) &&
            hasEvents && (
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                {eventQRs.map((event, idx) => (
                  <QRPreviewCard
                    key={idx}
                    qrUrl={event.qrUrl}
                    code={event.code}
                    label={event.label}
                    subtitle={event.subtitle}
                  />
                ))}
              </Box>
            )}
        </Box>
      </Paper>
    </Box>
  );
}

export default QRCodeSection;
