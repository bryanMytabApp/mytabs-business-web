import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  FormControlLabel,
  Switch,
} from "@mui/material";
import { setTaxOverride, removeTaxOverride } from "../../services/organizationService";
import { toast } from "react-toastify";

const TaxOverrideModal = ({ open, onClose, orgId, business, onSuccess }) => {
  const [useCustom, setUseCustom] = useState(false);
  const [taxId, setTaxId] = useState("");
  const [taxRate, setTaxRate] = useState("");
  const [taxJurisdiction, setTaxJurisdiction] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (business) {
      const hasOverride = !business.inheritTax;
      setUseCustom(hasOverride);
      setTaxId(business.taxIdOverride || "");
      setTaxRate(business.taxRateOverride != null ? String(business.taxRateOverride) : "");
      setTaxJurisdiction(business.taxJurisdictionOverride || "");
    }
  }, [business]);

  const handleConfirm = async () => {
    if (!business) return;
    const bizId = business.linkedBusinessId;

    try {
      setIsSubmitting(true);
      if (useCustom) {
        await setTaxOverride(orgId, bizId, {
          taxIdOverride: taxId,
          taxRateOverride: taxRate ? parseFloat(taxRate) : undefined,
          taxJurisdictionOverride: taxJurisdiction,
        });
        toast.success("Tax override applied");
      } else {
        await removeTaxOverride(orgId, bizId);
        toast.success("Tax override removed — inheriting from organization");
      }
      onClose();
      onSuccess();
    } catch (err) {
      toast.error("Failed to update tax settings");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontFamily: "Outfit", fontWeight: 600 }}>
        Tax Settings — {business?.name || "Business"}
      </DialogTitle>
      <DialogContent>
        <FormControlLabel
          control={
            <Switch
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              sx={{ "& .MuiSwitch-switchBase.Mui-checked": { color: "#F09925" }, "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { backgroundColor: "#F09925" } }}
            />
          }
          label={useCustom ? "Custom override" : "Inherit from organization"}
          sx={{ mt: 1, "& .MuiFormControlLabel-label": { fontFamily: "Outfit" } }}
        />
        {useCustom && (
          <>
            <TextField
              margin="dense"
              label="Tax ID"
              fullWidth
              variant="outlined"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              sx={{ mt: 2, "& .MuiInputBase-root": { fontFamily: "Outfit" } }}
            />
            <TextField
              margin="dense"
              label="Tax Rate (%)"
              fullWidth
              variant="outlined"
              type="number"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              sx={{ "& .MuiInputBase-root": { fontFamily: "Outfit" } }}
            />
            <TextField
              margin="dense"
              label="Tax Jurisdiction"
              fullWidth
              variant="outlined"
              value={taxJurisdiction}
              onChange={(e) => setTaxJurisdiction(e.target.value)}
              placeholder="e.g. US-TX"
              sx={{ "& .MuiInputBase-root": { fontFamily: "Outfit" } }}
            />
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} sx={{ fontFamily: "Outfit", color: "#71727A" }}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          disabled={isSubmitting}
          variant="contained"
          sx={{ fontFamily: "Outfit", backgroundColor: "#F09925", "&:hover": { backgroundColor: "#d9871e" } }}
        >
          {isSubmitting ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default TaxOverrideModal;
