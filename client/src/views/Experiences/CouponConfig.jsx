import React, { useState, useEffect, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { getInstance, updateInstance } from "../../services/experienceService";
import ThemeColorPicker from "./ThemeColorPicker";
import EngagementConfigShell from "./EngagementConfigShell";

const ACCENT = "#8B5CF6"; // Engagement & Loyalty brand color
const DEFAULT_ACCENT = "#8B5CF6"; // default theme color saved when none chosen

// Config limits — mirror the plugin's validateConfig rules (Requirement 1).
const LIMITS = {
  MIN_OFFERS: 1,
  MAX_OFFERS: 50,
  MAX_TITLE: 100,
  MAX_BENEFIT: 100,
  MAX_VENDOR: 100,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 1000000,
  MIN_CLAIM_LIMIT: 1,
  MAX_CLAIM_LIMIT: 1000,
};

const REDEMPTION_METHODS = [
  { value: "single-use-code", label: "Single-use code" },
  { value: "qr-scan", label: "QR scan" },
  { value: "show-and-tap", label: "Show and tap" },
];

const INVENTORY_MODES = [
  { value: "finite", label: "Finite (limited quantity)" },
  { value: "unlimited", label: "Unlimited" },
];

const STEPS = ["Coupon Offers", "Review & Save"];

let idCounter = 0;
const uid = (prefix) => `${prefix}-${Date.now()}-${idCounter++}`;

const makeOffer = () => ({
  id: uid("offer"),
  title: "",
  description: "",
  vendorName: "",
  benefitDescriptor: "",
  inventoryMode: "finite",
  totalQuantity: 100,
  perAttendeeClaimLimit: 1,
  claimStart: "",
  claimEnd: "",
  redemptionExpiry: "",
  redemptionMethod: "single-use-code",
});

const DEFAULT_FORM = {
  accentColor: DEFAULT_ACCENT,
  offers: [makeOffer()],
};

// Parse a datetime-local string into an epoch-ms number, or NaN when empty/invalid.
const toMs = (value) => {
  if (value === null || value === undefined || value === "") return NaN;
  return new Date(value).getTime();
};

/**
 * Validates the coupon-offer configuration form, reproducing the backend plugin
 * rules (Requirements 1.2–1.12) into an errors map keyed by field path (e.g.
 * `offers[2].benefitDescriptor`) so each control can surface its own error.
 * Returns an object of { fieldPath: message }. The plugin's validateConfig
 * remains the server-side authority.
 */
export function validateAll(form) {
  const errors = {};
  const offers = form?.offers || [];

  // Rule 1.2 — offer count 1..50.
  if (offers.length < LIMITS.MIN_OFFERS) {
    errors["offers"] = `At least ${LIMITS.MIN_OFFERS} coupon offer is required.`;
  } else if (offers.length > LIMITS.MAX_OFFERS) {
    errors["offers"] = `A maximum of ${LIMITS.MAX_OFFERS} coupon offers is allowed.`;
  }

  // Rule 1.12 — duplicate offerId detection.
  const seenIds = new Map();

  offers.forEach((offer, idx) => {
    // Rule 1.3 — title non-empty, <= 100 chars.
    const title = (offer.title ?? "").trim();
    if (title.length < 1) {
      errors[`offers[${idx}].title`] = "An offer title is required.";
    } else if (title.length > LIMITS.MAX_TITLE) {
      errors[`offers[${idx}].title`] = `Title must be ${LIMITS.MAX_TITLE} characters or fewer.`;
    }

    // Rule 1.4 — benefit descriptor non-empty, <= 100 chars.
    const benefit = (offer.benefitDescriptor ?? "").trim();
    if (benefit.length < 1) {
      errors[`offers[${idx}].benefitDescriptor`] = "A benefit descriptor is required.";
    } else if (benefit.length > LIMITS.MAX_BENEFIT) {
      errors[`offers[${idx}].benefitDescriptor`] = `Benefit must be ${LIMITS.MAX_BENEFIT} characters or fewer.`;
    }

    // Rule 1.5 — vendor name non-empty, <= 100 chars.
    const vendor = (offer.vendorName ?? "").trim();
    if (vendor.length < 1) {
      errors[`offers[${idx}].vendorName`] = "A vendor name is required.";
    } else if (vendor.length > LIMITS.MAX_VENDOR) {
      errors[`offers[${idx}].vendorName`] = `Vendor name must be ${LIMITS.MAX_VENDOR} characters or fewer.`;
    }

    // Rule 1.6/1.7 — finite offers require an integer totalQuantity 1..1,000,000;
    // unlimited offers carry no quantity.
    if (offer.inventoryMode === "finite") {
      const qty = Number(offer.totalQuantity);
      if (!Number.isInteger(qty) || qty < LIMITS.MIN_QUANTITY || qty > LIMITS.MAX_QUANTITY) {
        errors[`offers[${idx}].totalQuantity`] = `Total quantity must be an integer between ${LIMITS.MIN_QUANTITY} and ${LIMITS.MAX_QUANTITY.toLocaleString()}.`;
      }
    }

    // Rule 1.8 — per-attendee claim limit integer 1..1000.
    const claimLimit = Number(offer.perAttendeeClaimLimit);
    if (
      !Number.isInteger(claimLimit) ||
      claimLimit < LIMITS.MIN_CLAIM_LIMIT ||
      claimLimit > LIMITS.MAX_CLAIM_LIMIT
    ) {
      errors[`offers[${idx}].perAttendeeClaimLimit`] = `Claim limit must be an integer between ${LIMITS.MIN_CLAIM_LIMIT} and ${LIMITS.MAX_CLAIM_LIMIT}.`;
    }

    // Rule 1.10 — redemption method membership.
    const method = offer.redemptionMethod;
    if (!REDEMPTION_METHODS.some((m) => m.value === method)) {
      errors[`offers[${idx}].redemptionMethod`] = "Select a redemption method.";
    }

    // Rule 1.11 — window ordering: claimStart < claimEnd AND redemptionExpiry >= claimEnd.
    const startMs = toMs(offer.claimStart);
    const endMs = toMs(offer.claimEnd);
    const expiryMs = toMs(offer.redemptionExpiry);
    if (Number.isNaN(startMs)) {
      errors[`offers[${idx}].claimStart`] = "A claim start is required.";
    }
    if (Number.isNaN(endMs)) {
      errors[`offers[${idx}].claimEnd`] = "A claim end is required.";
    }
    if (Number.isNaN(expiryMs)) {
      errors[`offers[${idx}].redemptionExpiry`] = "A redemption expiry is required.";
    }
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && startMs >= endMs) {
      errors[`offers[${idx}].claimEnd`] = "Claim end must be later than claim start.";
    }
    if (!Number.isNaN(endMs) && !Number.isNaN(expiryMs) && expiryMs < endMs) {
      errors[`offers[${idx}].redemptionExpiry`] = "Redemption expiry must be at or after claim end.";
    }

    // Rule 1.12 — duplicate offerId flagged at the offending offer.
    const offerId = offer.id;
    if (offerId) {
      if (seenIds.has(offerId)) {
        errors[`offers[${idx}].offerId`] = `Duplicate offer id: ${offerId}.`;
      } else {
        seenIds.set(offerId, idx);
      }
    }
  });

  return errors;
}

/**
 * OfferEditor — isolated editor for a single coupon offer. Wrapped in
 * React.memo (like Treasure Hunts' CheckpointEditor / Raffles' PrizeItem) so
 * editing one offer does not re-render siblings and text fields keep focus
 * across keystrokes. The Total_Quantity control is shown/enabled only when the
 * inventory mode is `finite` and hidden when `unlimited` (Requirement 9.4).
 */
const OfferEditor = memo(({ offer, idx, count, errors, onUpdate, onDelete }) => {
  const titleValue = offer.title ?? "";
  const vendorValue = offer.vendorName ?? "";
  const benefitValue = offer.benefitDescriptor ?? "";
  const isFinite = offer.inventoryMode === "finite";

  const updateField = (key, value) => onUpdate({ ...offer, [key]: value });

  const updateNumber = (key, raw) => {
    const value = raw === "" ? "" : parseInt(raw, 10);
    onUpdate({ ...offer, [key]: value });
  };

  return (
    <Box
      data-testid={`offer-editor-${idx}`}
      sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
          Coupon Offer {idx + 1}
        </Typography>
        <IconButton
          size="small"
          aria-label={`Remove offer ${idx + 1}`}
          onClick={onDelete}
          disabled={count <= LIMITS.MIN_OFFERS}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <TextField
        fullWidth
        size="small"
        label="Offer Title"
        value={titleValue}
        onChange={(e) => updateField("title", e.target.value)}
        error={!!errors[`offers[${idx}].title`]}
        helperText={errors[`offers[${idx}].title`] || `${titleValue.length}/${LIMITS.MAX_TITLE}`}
        inputProps={{ maxLength: LIMITS.MAX_TITLE + 1 }}
        sx={{ mb: 2 }}
      />

      <TextField
        fullWidth
        size="small"
        label="Description"
        value={offer.description ?? ""}
        onChange={(e) => updateField("description", e.target.value)}
        error={!!errors[`offers[${idx}].description`]}
        helperText={errors[`offers[${idx}].description`] || "Optional details shown to attendees."}
        multiline
        minRows={2}
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <TextField
          size="small"
          label="Vendor Name"
          value={vendorValue}
          onChange={(e) => updateField("vendorName", e.target.value)}
          error={!!errors[`offers[${idx}].vendorName`]}
          helperText={errors[`offers[${idx}].vendorName`] || `${vendorValue.length}/${LIMITS.MAX_VENDOR}`}
          inputProps={{ maxLength: LIMITS.MAX_VENDOR + 1 }}
          sx={{ flex: 1, minWidth: 220 }}
        />
        <TextField
          size="small"
          label="Benefit Descriptor"
          value={benefitValue}
          onChange={(e) => updateField("benefitDescriptor", e.target.value)}
          error={!!errors[`offers[${idx}].benefitDescriptor`]}
          helperText={
            errors[`offers[${idx}].benefitDescriptor`] || `${benefitValue.length}/${LIMITS.MAX_BENEFIT}`
          }
          inputProps={{ maxLength: LIMITS.MAX_BENEFIT + 1 }}
          sx={{ flex: 1, minWidth: 220 }}
        />
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap", alignItems: "flex-start" }}>
        <FormControl size="small" sx={{ minWidth: 220 }} error={!!errors[`offers[${idx}].inventoryMode`]}>
          <InputLabel id={`inventory-mode-label-${idx}`}>Inventory</InputLabel>
          <Select
            labelId={`inventory-mode-label-${idx}`}
            label="Inventory"
            value={offer.inventoryMode}
            onChange={(e) => updateField("inventoryMode", e.target.value)}
            inputProps={{ "aria-label": `Inventory for offer ${idx + 1}` }}
          >
            {INVENTORY_MODES.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Total quantity is shown/enabled only when finite (Requirement 9.4). */}
        {isFinite && (
          <TextField
            size="small"
            type="number"
            label="Total Quantity"
            value={offer.totalQuantity ?? ""}
            onChange={(e) => updateNumber("totalQuantity", e.target.value)}
            error={!!errors[`offers[${idx}].totalQuantity`]}
            helperText={
              errors[`offers[${idx}].totalQuantity`] ||
              `${LIMITS.MIN_QUANTITY}–${LIMITS.MAX_QUANTITY.toLocaleString()}`
            }
            inputProps={{
              min: LIMITS.MIN_QUANTITY,
              max: LIMITS.MAX_QUANTITY,
              "aria-label": `Total quantity for offer ${idx + 1}`,
            }}
            sx={{ width: 200 }}
          />
        )}

        <TextField
          size="small"
          type="number"
          label="Per-Attendee Claim Limit"
          value={offer.perAttendeeClaimLimit ?? ""}
          onChange={(e) => updateNumber("perAttendeeClaimLimit", e.target.value)}
          error={!!errors[`offers[${idx}].perAttendeeClaimLimit`]}
          helperText={
            errors[`offers[${idx}].perAttendeeClaimLimit`] ||
            `${LIMITS.MIN_CLAIM_LIMIT}–${LIMITS.MAX_CLAIM_LIMIT}`
          }
          inputProps={{
            min: LIMITS.MIN_CLAIM_LIMIT,
            max: LIMITS.MAX_CLAIM_LIMIT,
            "aria-label": `Per-attendee claim limit for offer ${idx + 1}`,
          }}
          sx={{ width: 200 }}
        />
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <TextField
          size="small"
          type="datetime-local"
          label="Claim Start"
          value={offer.claimStart ?? ""}
          onChange={(e) => updateField("claimStart", e.target.value)}
          error={!!errors[`offers[${idx}].claimStart`]}
          helperText={errors[`offers[${idx}].claimStart`] || " "}
          InputLabelProps={{ shrink: true }}
          inputProps={{ "aria-label": `Claim start for offer ${idx + 1}` }}
          sx={{ width: 240 }}
        />
        <TextField
          size="small"
          type="datetime-local"
          label="Claim End"
          value={offer.claimEnd ?? ""}
          onChange={(e) => updateField("claimEnd", e.target.value)}
          error={!!errors[`offers[${idx}].claimEnd`]}
          helperText={errors[`offers[${idx}].claimEnd`] || " "}
          InputLabelProps={{ shrink: true }}
          inputProps={{ "aria-label": `Claim end for offer ${idx + 1}` }}
          sx={{ width: 240 }}
        />
        <TextField
          size="small"
          type="datetime-local"
          label="Redemption Expiry"
          value={offer.redemptionExpiry ?? ""}
          onChange={(e) => updateField("redemptionExpiry", e.target.value)}
          error={!!errors[`offers[${idx}].redemptionExpiry`]}
          helperText={errors[`offers[${idx}].redemptionExpiry`] || " "}
          InputLabelProps={{ shrink: true }}
          inputProps={{ "aria-label": `Redemption expiry for offer ${idx + 1}` }}
          sx={{ width: 240 }}
        />
      </Box>

      <FormControl size="small" sx={{ minWidth: 260 }} error={!!errors[`offers[${idx}].redemptionMethod`]}>
        <InputLabel id={`redemption-method-label-${idx}`}>Redemption Method</InputLabel>
        <Select
          labelId={`redemption-method-label-${idx}`}
          label="Redemption Method"
          value={offer.redemptionMethod}
          onChange={(e) => updateField("redemptionMethod", e.target.value)}
          inputProps={{ "aria-label": `Redemption method for offer ${idx + 1}` }}
        >
          {REDEMPTION_METHODS.map((m) => (
            <MenuItem key={m.value} value={m.value}>
              {m.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      {errors[`offers[${idx}].redemptionMethod`] && (
        <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
          {errors[`offers[${idx}].redemptionMethod`]}
        </Typography>
      )}
    </Box>
  );
});

OfferEditor.displayName = "OfferEditor";

/**
 * CouponConfig — organizer-facing configuration screen for a Digital Coupons
 * experience instance. Mirrors TreasureHuntConfig/RaffleConfig's stepped MUI
 * form: memoized offer editors preserving input focus, an errors map keyed by
 * field path, client-side validation reproducing the plugin rules (1.2–1.12),
 * and a save that persists the config via updateInstance. The saved config
 * shapes each offer's inventory as { mode:'finite', totalQuantity } or
 * { mode:'unlimited' } to match the plugin's Coupon_Config.
 */
const CouponConfig = () => {
  const { eventId, experienceId } = useParams();
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [, setSaved] = useState(false);

  // Convert a stored ISO timestamp to the value a datetime-local input expects
  // (YYYY-MM-DDTHH:mm, local time). Empty/invalid inputs map to "".
  const toLocalInput = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Load any existing config so the organizer edits rather than overwrites.
  useEffect(() => {
    if (!eventId || !experienceId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getInstance(eventId, experienceId);
        const instance = res.data?.data || res.data;
        const cfg = instance?.config;
        if (!cancelled && cfg?.offers?.length) {
          setForm({
            accentColor: cfg.accentColor || DEFAULT_ACCENT,
            offers: cfg.offers.map((o, oi) => ({
              id: o.offerId || o.id || `offer-${oi}`,
              title: o.title ?? "",
              description: o.description ?? "",
              vendorName: o.vendorName ?? "",
              benefitDescriptor: o.benefitDescriptor ?? "",
              inventoryMode: o.inventory?.mode === "unlimited" ? "unlimited" : "finite",
              totalQuantity: o.inventory?.totalQuantity ?? 100,
              perAttendeeClaimLimit: o.perAttendeeClaimLimit ?? 1,
              claimStart: toLocalInput(o.claimStart),
              claimEnd: toLocalInput(o.claimEnd),
              redemptionExpiry: toLocalInput(o.redemptionExpiry),
              redemptionMethod: o.redemptionMethod || "single-use-code",
            })),
          });
        }
      } catch (err) {
        // Non-fatal: a brand-new instance has no config yet.
        console.log("CouponConfig: no existing config", err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, experienceId]);

  // ── Offer mutations ────────────────────────────────────────────────────────
  const updateOffer = (idx, updated) => {
    setForm((prev) => ({
      ...prev,
      offers: prev.offers.map((o, i) => (i === idx ? updated : o)),
    }));
    setSaved(false);
  };

  const addOffer = () => {
    setForm((prev) =>
      prev.offers.length >= LIMITS.MAX_OFFERS
        ? prev
        : { ...prev, offers: [...prev.offers, makeOffer()] }
    );
    setSaved(false);
  };

  const removeOffer = (idx) => {
    setForm((prev) => {
      if (prev.offers.length <= LIMITS.MIN_OFFERS) return prev;
      return { ...prev, offers: prev.offers.filter((_, i) => i !== idx) };
    });
    setSaved(false);
  };

  const handleSave = async () => {
    const allErrors = validateAll(form);
    setErrors(allErrors);
    if (Object.keys(allErrors).length > 0) {
      setSaveError("Please fix the highlighted fields before saving.");
      setSaved(false);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const config = {
        accentColor: form.accentColor || DEFAULT_ACCENT,
        offers: form.offers.map((o) => {
          const inventory =
            o.inventoryMode === "unlimited"
              ? { mode: "unlimited" }
              : { mode: "finite", totalQuantity: Number(o.totalQuantity) };
          return {
            offerId: o.id,
            title: o.title.trim(),
            description: (o.description || "").trim(),
            vendorName: o.vendorName.trim(),
            benefitDescriptor: o.benefitDescriptor.trim(),
            inventory,
            perAttendeeClaimLimit: Number(o.perAttendeeClaimLimit),
            claimStart: new Date(o.claimStart).toISOString(),
            claimEnd: new Date(o.claimEnd).toISOString(),
            redemptionExpiry: new Date(o.redemptionExpiry).toISOString(),
            redemptionMethod: o.redemptionMethod,
          };
        }),
      };
      await updateInstance(eventId, experienceId, { config });
      setSaved(true);
      // Return to the engagements dashboard after a successful save (matches Raffle).
      navigate(`/admin/my-events/${eventId}/experiences`);
    } catch (err) {
      setSaveError(
        err.response?.data?.message || err.message || "Failed to save coupon configuration."
      );
    } finally {
      setSaving(false);
    }
  };

  const renderOffersStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Coupon Offers ({form.offers.length}/{LIMITS.MAX_OFFERS})
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Define each coupon attendees can claim. Set the vendor, the benefit, the inventory, the per-attendee claim limit, the claim window, the redemption expiry, and how it is redeemed.
      </Typography>

      <ThemeColorPicker
        value={form.accentColor}
        onChange={(hex) => {
          setForm((prev) => ({ ...prev, accentColor: hex }));
          setSaved(false);
        }}
        helper="Accent color used across this coupon wallet's display"
      />

      {errors["offers"] && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {errors["offers"]}
        </Alert>
      )}

      {form.offers.map((offer, idx) => (
        <OfferEditor
          key={offer.id}
          offer={offer}
          idx={idx}
          count={form.offers.length}
          errors={errors}
          onUpdate={(updated) => updateOffer(idx, updated)}
          onDelete={() => removeOffer(idx)}
        />
      ))}

      <Button
        startIcon={<AddIcon />}
        onClick={addOffer}
        disabled={form.offers.length >= LIMITS.MAX_OFFERS}
        variant="outlined"
        sx={{ textTransform: "none", borderColor: ACCENT, color: ACCENT }}
      >
        Add Coupon Offer
      </Button>
    </Box>
  );

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Review & Save
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Review your coupon offers, then save the configuration to this experience.
      </Typography>

      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#F8F9FA" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>
          {form.offers.length} coupon offer{form.offers.length === 1 ? "" : "s"}
        </Typography>
        {form.offers.map((offer, idx) => (
          <Typography key={offer.id} sx={{ fontSize: 13, color: "#374151" }}>
            {idx + 1}. {offer.title || `Offer ${idx + 1}`}{" "}
            <Typography component="span" sx={{ fontSize: 12, color: "#6B7280" }}>
              ({offer.vendorName || "vendor"} ·{" "}
              {offer.inventoryMode === "unlimited"
                ? "Unlimited"
                : `${offer.totalQuantity} available`}
              )
            </Typography>
          </Typography>
        ))}
      </Box>

    </Box>
  );

  const renderStep = () => {
    if (activeStep === 0) return renderOffersStep();
    return renderReviewStep();
  };

  return (
    <EngagementConfigShell
      title="Configure Digital Coupons"
      subtitle="Distribute redeemable digital coupons to attendees for vendors and sponsors."
      steps={STEPS}
      activeStep={activeStep}
      onStepClick={(i) => setActiveStep(i)}
      onBack={() =>
        activeStep === 0
          ? navigate(`/admin/my-events/${eventId}/experiences`)
          : setActiveStep(activeStep - 1)
      }
      onNext={() => setActiveStep(activeStep + 1)}
      onSave={handleSave}
      saving={saving}
      errorText={saveError}
    >
      {renderStep()}
    </EngagementConfigShell>
  );
};

export default CouponConfig;
