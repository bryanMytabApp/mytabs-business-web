import React, { useState, useEffect } from "react";
import { Box, Typography, Divider } from "@mui/material";
import { QRCodeSection, QRCodeGenerator } from "../../components/QR";
import http from "../../utils/axios/http";

/**
 * BusinessQRIntegration - Integrates QRCodeSection into the business detail page.
 * This component wraps the QR code section with API calls for code generation
 * and destination management.
 *
 * Integration point: Add this component to MyBusiness.jsx inside the Profile tab (activeTab === 0),
 * below the SettingsCard component, or as a new "QR Codes" tab.
 *
 * Example integration in MyBusiness.jsx:
 *   1. Import: import BusinessQRIntegration from "./BusinessQRIntegration";
 *   2. Add a new Tab: <Tab label="QR Codes" />
 *   3. Add tab panel: {activeTab === 3 && <BusinessQRIntegration business={item} />}
 *
 * Props:
 * - business (object): The business item from MyBusiness state (item)
 *
 * Requirements: 4.2, 4.9
 */
export function BusinessQRIntegration({ business }) {
  const [businessCode, setBusinessCode] = useState(business?.businessCode || null);
  const [menus, setMenus] = useState([]);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    if (business?.businessCode) {
      setBusinessCode(business.businessCode);
    }
    // Build menus array from business data
    const menuList = [];
    for (let i = 1; i <= 4; i++) {
      if (business?.[`menuUrl${i}`]) {
        menuList.push({
          url: business[`menuUrl${i}`],
          label: business[`menuLabel${i}`] || `Menu ${i}`,
          menuCode: business[`menuCode${i}`] || null,
        });
      }
    }
    setMenus(menuList);

    // Events would come from a separate API call
    if (business?._id) {
      loadEvents(business._id);
    }
  }, [business]);

  const loadEvents = async (businessId) => {
    try {
      const response = await http.get(`/api/events/business/${businessId}`);
      if (response.data) {
        setEvents(
          (response.data || []).map((evt) => ({
            eventId: evt._id,
            name: evt.name,
            eventCode: evt.eventCode || null,
            date: evt.startDate,
          }))
        );
      }
    } catch (err) {
      // Events are optional - don't block QR section
      console.warn("Could not load events for QR section:", err);
    }
  };

  const handleCodeGenerated = (data) => {
    if (data?.publicCode) {
      setBusinessCode(data.publicCode);
    }
  };

  // Build the business object for QRCodeSection
  const qrBusiness = {
    businessCode: businessCode,
    name: business?.name || "Business",
    menus: menus,
    events: events,
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Divider sx={{ mb: 2 }} />

      {/* Show generator if no code exists */}
      {!businessCode && (
        <QRCodeGenerator
          entityType="business"
          entityId={business?._id}
          hasPublicCode={false}
          onCodeGenerated={handleCodeGenerated}
        />
      )}

      {/* Show QR code section when code exists */}
      {businessCode && <QRCodeSection business={qrBusiness} />}
    </Box>
  );
}

export default BusinessQRIntegration;
