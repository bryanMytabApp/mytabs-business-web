import React, { useState } from "react";
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
} from "@mui/material";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import RestaurantMenuIcon from "@mui/icons-material/RestaurantMenu";
import QRCode from "react-qr-code";
import http from "../../utils/axios/http";
import { QRDownloadButton } from "./QRDownloadButton";

/**
 * MenuQRSection - Displays menu QR codes for a business (up to 4 menus).
 *
 * Props:
 * - businessId (string): UUID of the business
 * - businessCode (string): The business's public code segment (e.g., "BIZ-XXXX")
 * - menus (array): Array of { url, label, menuCode? } objects (max 4)
 *
 * Requirements: 5.1, 5.2, 5.7, 5.8
 */
export function MenuQRSection({ businessId, businessCode, menus = [] }) {
  const [menuCodes, setMenuCodes] = useState(() => {
    // Initialize with existing menu codes
    const codes = {};
    menus.forEach((menu, idx) => {
      if (menu.menuCode) {
        codes[idx] = {
          publicCode: menu.menuCode,
          qrUrl: `https://keeptabs.app/m/${menu.menuCode}`,
        };
      }
    });
    return codes;
  });
  const [generating, setGenerating] = useState({});
  const [errors, setErrors] = useState({});

  const handleGenerateMenuQR = async (menuIndex) => {
    const menu = menus[menuIndex];
    if (!menu?.url) return;

    setGenerating((prev) => ({ ...prev, [menuIndex]: true }));
    setErrors((prev) => ({ ...prev, [menuIndex]: null }));

    try {
      const response = await http.post("/api/codes/generate", {
        entityType: "menu",
        entityId: `${businessId}-menu-${menuIndex + 1}`,
        businessCode: businessCode,
      });

      if (response.data) {
        setMenuCodes((prev) => ({
          ...prev,
          [menuIndex]: {
            publicCode: response.data.publicCode,
            qrUrl: response.data.qrUrl,
          },
        }));
      }
    } catch (err) {
      const message =
        err.response?.data?.message || "Failed to generate menu QR code.";
      setErrors((prev) => ({ ...prev, [menuIndex]: message }));
    } finally {
      setGenerating((prev) => ({ ...prev, [menuIndex]: false }));
    }
  };

  if (!menus || menus.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No menus configured for this business. Add menu URLs to generate QR
          codes.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <RestaurantMenuIcon />
        Menu QR Codes
      </Typography>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {menus.slice(0, 4).map((menu, idx) => {
          if (!menu.url) return null;

          const menuData = menuCodes[idx];
          const isGenerating = generating[idx];
          const menuError = errors[idx];

          return (
            <Card key={idx} variant="outlined">
              <CardContent>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    flexWrap: "wrap",
                    gap: 2,
                  }}
                >
                  {/* Menu Info */}
                  <Box sx={{ flex: 1, minWidth: 200 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        {menu.label || `Menu ${idx + 1}`}
                      </Typography>
                      <Chip
                        label={`Menu ${idx + 1}`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ wordBreak: "break-all" }}
                    >
                      {menu.url}
                    </Typography>

                    {menuData && (
                      <Typography
                        variant="body2"
                        sx={{
                          mt: 1,
                          fontFamily: "monospace",
                          color: "text.secondary",
                        }}
                      >
                        Code: {menuData.publicCode}
                      </Typography>
                    )}

                    {menuError && (
                      <Alert severity="error" sx={{ mt: 1 }}>
                        {menuError}
                      </Alert>
                    )}
                  </Box>

                  {/* QR Preview & Actions */}
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    {menuData ? (
                      <>
                        <Box
                          sx={{
                            p: 1,
                            backgroundColor: "#fff",
                            borderRadius: 1,
                            border: "1px solid #e0e0e0",
                          }}
                        >
                          <QRCode
                            value={menuData.qrUrl}
                            size={100}
                            level="H"
                          />
                        </Box>
                        <QRDownloadButton
                          qrUrl={menuData.qrUrl}
                          publicCode={menuData.publicCode}
                          entityName={menu.label || `Menu ${idx + 1}`}
                        />
                      </>
                    ) : (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={
                          isGenerating ? (
                            <CircularProgress size={16} color="inherit" />
                          ) : (
                            <QrCode2Icon />
                          )
                        }
                        onClick={() => handleGenerateMenuQR(idx)}
                        disabled={isGenerating}
                        sx={{ textTransform: "none" }}
                      >
                        {isGenerating ? "Generating..." : "Generate Menu QR"}
                      </Button>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
}

export default MenuQRSection;
