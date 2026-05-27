import React, { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import http from "../../utils/axios/http";

/**
 * QRCodeGenerator - Handles QR code generation via the API.
 *
 * Props:
 * - entityType (string): 'business', 'menu', 'event', 'organization'
 * - entityId (string): UUID of the entity
 * - parentCode (string, optional): For org-scoped businesses (e.g., 'ORG-XXXX')
 * - businessCode (string, optional): For menu/event codes (e.g., 'BIZ-XXXX')
 * - hasPublicCode (boolean): Whether the entity already has a public code assigned
 * - onCodeGenerated (function): Callback when code is successfully generated
 */
export function QRCodeGenerator({
  entityType,
  entityId,
  parentCode,
  businessCode,
  hasPublicCode,
  onCodeGenerated,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    try {
      const requestBody = {
        entityType,
        entityId,
      };

      if (parentCode) {
        requestBody.parentCode = parentCode;
      }
      if (businessCode) {
        requestBody.businessCode = businessCode;
      }

      const response = await http.post("/api/codes/generate", requestBody);

      if (response.data && onCodeGenerated) {
        onCodeGenerated(response.data);
      }
    } catch (err) {
      const message =
        err.response?.data?.message ||
        err.response?.data?.error ||
        "Failed to generate QR code. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // Disable generation if entity has no public code and show warning
  if (!hasPublicCode) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="warning" sx={{ mb: 1 }}>
          A public code must be assigned to this {entityType} before a QR code
          can be generated.
        </Alert>
        <Button
          variant="contained"
          disabled
          startIcon={<QrCode2Icon />}
          sx={{ textTransform: "none" }}
        >
          Generate QR Code
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Button
        variant="contained"
        onClick={handleGenerate}
        disabled={loading}
        startIcon={
          loading ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            <QrCode2Icon />
          )
        }
        sx={{ textTransform: "none" }}
      >
        {loading ? "Generating..." : "Generate QR Code"}
      </Button>
    </Box>
  );
}

export default QRCodeGenerator;
