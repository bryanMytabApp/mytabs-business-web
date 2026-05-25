import React, { useState, useEffect } from "react";
import { Box, Divider } from "@mui/material";
import { MenuQRSection } from "../../components/QR";

/**
 * BusinessMenuQRIntegration - Integrates MenuQRSection into the business detail page.
 * Displays below the business QR section, providing menu-specific QR code generation.
 *
 * Integration point: Add this component to MyBusiness.jsx inside the "QR Codes" tab,
 * below the BusinessQRIntegration component.
 *
 * Example integration in MyBusiness.jsx:
 *   1. Import: import BusinessMenuQRIntegration from "./BusinessMenuQRIntegration";
 *   2. Place below BusinessQRIntegration:
 *      {activeTab === 3 && (
 *        <>
 *          <BusinessQRIntegration business={item} />
 *          <BusinessMenuQRIntegration business={item} />
 *        </>
 *      )}
 *
 * Props:
 * - business (object): The business item from MyBusiness state (item)
 *
 * Requirements: 5.1, 5.7
 */
export function BusinessMenuQRIntegration({ business }) {
  const [menus, setMenus] = useState([]);

  useEffect(() => {
    if (!business) return;

    // Build menus array from business data (menuUrl1-4, menuLabel1-4)
    const menuList = [];
    for (let i = 1; i <= 4; i++) {
      if (business[`menuUrl${i}`]) {
        menuList.push({
          url: business[`menuUrl${i}`],
          label: business[`menuLabel${i}`] || `Menu ${i}`,
          menuCode: business[`menuCode${i}`] || null,
        });
      }
    }
    setMenus(menuList);
  }, [business]);

  if (!business?.businessCode) {
    return null; // Don't show menu QR section if business has no code
  }

  return (
    <Box sx={{ mt: 2 }}>
      <Divider sx={{ mb: 2 }} />
      <MenuQRSection
        businessId={business._id}
        businessCode={business.businessCode}
        menus={menus}
      />
    </Box>
  );
}

export default BusinessMenuQRIntegration;
