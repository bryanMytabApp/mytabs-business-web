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
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import { getInstance, updateInstance, participate } from "../../services/experienceService";
import ThemeColorPicker from "./ThemeColorPicker";
import EngagementConfigShell from "./EngagementConfigShell";

const ACCENT = "#8B5CF6"; // Engagement & Loyalty brand color
const DEFAULT_ACCENT = "#8B5CF6"; // default theme color saved when none chosen

// Config limits — mirror the plugin's validateConfig rules (Requirements 1.x–4.x).
const LIMITS = {
  MIN_PROMOTIONS: 1,
  MAX_PROMOTIONS: 50,
  MAX_HEADLINE: 100,
  MAX_DESCRIPTION: 500,
  MAX_CTA_LABEL: 40,
  MAX_CREATIVE_BYTES: 5242880, // 5 MB (Req 2.4)
  MIN_GOAL: 1,
  MAX_GOAL: 100000000, // 1e8 (Req 4.2/4.3)
};

// Creative media types accepted by the plugin (Req 2.3) — also the client-side upload allow-list.
const CREATIVE_MEDIA_TYPES = ["image/png", "image/jpeg", "image/webp"];

const PLACEMENT_OPTIONS = [
  { value: "feed-card", label: "Feed Card" },
  { value: "banner", label: "Banner" },
  { value: "interstitial", label: "Interstitial" },
];

const CTA_TARGET_TYPES = [
  { value: "external-link", label: "External link" },
  { value: "coupon-offer", label: "Coupon offer" },
  { value: "event-detail", label: "Event detail" },
];

const STEPS = ["Promotions", "Review & Save"];

let idCounter = 0;
const uid = (prefix) => `${prefix}-${Date.now()}-${idCounter++}`;

const makePromotion = () => ({
  promotionId: uid("promo"),
  sponsorId: "",
  creativeAssetUrl: "",
  creativeMediaType: "",
  creativeSizeBytes: 0,
  headline: "",
  description: "",
  cta: { label: "", targetType: "external-link", targetValue: "" },
  placement: "feed-card",
  displayWindow: { start: "", end: "" },
  impressionGoal: "",
  engagementGoal: "",
});

const DEFAULT_FORM = {
  accentColor: DEFAULT_ACCENT,
  promotions: [makePromotion()],
};

// Parse a datetime-local string into an epoch-ms number, or NaN when empty/invalid.
const toMs = (value) => {
  if (value === null || value === undefined || value === "") return NaN;
  return new Date(value).getTime();
};

// Absolute-https validator for external-link CTA targets (Req 3.3).
const isAbsoluteHttpsUrl = (value) => {
  if (typeof value !== "string" || value.trim().length === 0) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:";
  } catch {
    return false;
  }
};

// A goal value is optional; when present it must be an integer within [MIN_GOAL, MAX_GOAL].
const isValidGoal = (raw) => {
  const n = Number(raw);
  return Number.isInteger(n) && n >= LIMITS.MIN_GOAL && n <= LIMITS.MAX_GOAL;
};
const goalProvided = (raw) => raw !== "" && raw !== null && raw !== undefined;

/**
 * Validates the sponsor-promotion configuration form, reproducing the backend
 * plugin rules (Requirements 1.2–1.8, 2.2–2.5, 3.1–3.6, 4.1–4.5) into an errors
 * map keyed by field path (e.g. `promotions[0].cta.targetValue`) so each control
 * can surface its own error. `sponsorIds` is the Set of Sponsor_Ids loaded from
 * the instance; a promotion's sponsorId must belong to it (Req 1.3/1.4). The
 * plugin's validateConfig remains the server-side authority.
 */
export function validateAll(form, sponsorIds) {
  const errors = {};
  const promotions = form?.promotions || [];
  const validSponsorIds = sponsorIds instanceof Set ? sponsorIds : new Set(sponsorIds || []);

  // Rule 1.2 — promotion count 1..50.
  if (promotions.length < LIMITS.MIN_PROMOTIONS) {
    errors["promotions"] = `At least ${LIMITS.MIN_PROMOTIONS} promotion is required.`;
  } else if (promotions.length > LIMITS.MAX_PROMOTIONS) {
    errors["promotions"] = `A maximum of ${LIMITS.MAX_PROMOTIONS} promotions is allowed.`;
  }

  // Rule 1.8 — duplicate promotionId detection.
  const seenIds = new Map();

  promotions.forEach((promo, idx) => {
    const path = `promotions[${idx}]`;

    // Rule 1.3/1.4 — sponsorId must reference an existing sponsor.
    const sponsorId = (promo.sponsorId ?? "").trim();
    if (sponsorId.length < 1) {
      errors[`${path}.sponsorId`] = "Select a sponsor for this promotion.";
    } else if (!validSponsorIds.has(sponsorId)) {
      errors[`${path}.sponsorId`] = `Unknown sponsor: ${sponsorId}.`;
    }

    // Rule 2.2 — creative asset url non-empty.
    const creativeAssetUrl = (promo.creativeAssetUrl ?? "").trim();
    if (creativeAssetUrl.length < 1) {
      errors[`${path}.creativeAssetUrl`] = "Upload a creative asset.";
    }

    // Rule 2.3/2.5 — creative media type membership (only when a creative exists).
    if (creativeAssetUrl.length >= 1 && !CREATIVE_MEDIA_TYPES.includes(promo.creativeMediaType)) {
      errors[`${path}.creativeMediaType`] = "Creative must be a PNG, JPEG, or WebP image.";
    }

    // Rule 2.4/2.5 — creative size bound (only when a creative exists).
    if (creativeAssetUrl.length >= 1) {
      const size = Number(promo.creativeSizeBytes);
      if (!Number.isInteger(size) || size < 1 || size > LIMITS.MAX_CREATIVE_BYTES) {
        errors[`${path}.creativeSizeBytes`] = "Creative must be 5 MB or smaller.";
      }
    }

    // Rule 1.5 — headline non-empty, <= 100 chars.
    const headline = (promo.headline ?? "").trim();
    if (headline.length < 1) {
      errors[`${path}.headline`] = "A headline is required.";
    } else if (headline.length > LIMITS.MAX_HEADLINE) {
      errors[`${path}.headline`] = `Headline must be ${LIMITS.MAX_HEADLINE} characters or fewer.`;
    }

    // Rule 1.6 — description <= 500 chars (optional).
    const description = promo.description ?? "";
    if (description.length > LIMITS.MAX_DESCRIPTION) {
      errors[`${path}.description`] = `Description must be ${LIMITS.MAX_DESCRIPTION} characters or fewer.`;
    }

    // Rule 1.7 — placement membership.
    if (!PLACEMENT_OPTIONS.some((p) => p.value === promo.placement)) {
      errors[`${path}.placement`] = "Select a placement.";
    }

    // CTA rules (Req 3.1–3.6).
    const cta = promo.cta || {};
    const ctaLabel = (cta.label ?? "").trim();
    if (ctaLabel.length < 1) {
      errors[`${path}.cta.label`] = "A call-to-action label is required.";
    } else if (ctaLabel.length > LIMITS.MAX_CTA_LABEL) {
      errors[`${path}.cta.label`] = `Label must be ${LIMITS.MAX_CTA_LABEL} characters or fewer.`;
    }

    if (!CTA_TARGET_TYPES.some((t) => t.value === cta.targetType)) {
      errors[`${path}.cta.targetType`] = "Select a target type.";
    }

    // Rule 3.3/3.4/3.5/3.6 — target value validation adapts to the target type.
    const targetValue = (cta.targetValue ?? "").trim();
    if (cta.targetType === "external-link") {
      if (!isAbsoluteHttpsUrl(targetValue)) {
        errors[`${path}.cta.targetValue`] = "Enter an absolute https:// URL.";
      }
    } else if (cta.targetType === "coupon-offer" || cta.targetType === "event-detail") {
      if (targetValue.length < 1) {
        errors[`${path}.cta.targetValue`] = "A target value is required.";
      }
    }

    // Rule 4.1 — displayWindow.start < displayWindow.end.
    const startMs = toMs(promo.displayWindow?.start);
    const endMs = toMs(promo.displayWindow?.end);
    if (Number.isNaN(startMs)) {
      errors[`${path}.displayWindow.start`] = "A start is required.";
    }
    if (Number.isNaN(endMs)) {
      errors[`${path}.displayWindow.end`] = "An end is required.";
    }
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && startMs >= endMs) {
      errors[`${path}.displayWindow.end`] = "End must be later than start.";
    }

    // Rule 4.2 — impressionGoal integer 1..1e8 when present.
    const impressionProvided = goalProvided(promo.impressionGoal);
    if (impressionProvided && !isValidGoal(promo.impressionGoal)) {
      errors[`${path}.impressionGoal`] = `Impression goal must be an integer between ${LIMITS.MIN_GOAL} and ${LIMITS.MAX_GOAL.toLocaleString()}.`;
    }

    // Rule 4.3 — engagementGoal integer 1..1e8 when present.
    const engagementProvided = goalProvided(promo.engagementGoal);
    if (engagementProvided && !isValidGoal(promo.engagementGoal)) {
      errors[`${path}.engagementGoal`] = `Engagement goal must be an integer between ${LIMITS.MIN_GOAL} and ${LIMITS.MAX_GOAL.toLocaleString()}.`;
    }

    // Rule 4.4 — engagementGoal <= impressionGoal when both set.
    if (
      impressionProvided &&
      engagementProvided &&
      isValidGoal(promo.impressionGoal) &&
      isValidGoal(promo.engagementGoal) &&
      Number(promo.engagementGoal) > Number(promo.impressionGoal)
    ) {
      errors[`${path}.engagementGoal`] = "Engagement goal cannot exceed the impression goal.";
    }

    // Rule 1.8 — duplicate promotionId flagged at the offending promotion.
    const promotionId = promo.promotionId;
    if (promotionId) {
      if (seenIds.has(promotionId)) {
        errors[`${path}.promotionId`] = `Duplicate promotion id: ${promotionId}.`;
      } else {
        seenIds.set(promotionId, idx);
      }
    }
  });

  return errors;
}

/**
 * Normalizes the instance's sponsor set the same way the plugin's `listSponsors`
 * does: every entry in `instance.sponsors` is included; the `instance.sponsorBranding`
 * backward-compat primary is added only when its `sponsorId` is not already present;
 * and the singular `instance.sponsor` (the shape SponsorManagement.jsx currently writes)
 * is folded in as a further fallback. De-duplicated by sponsorId, returning
 * `[{ sponsorId, displayName }]`.
 */
export function normalizeSponsors(instance) {
  const byId = new Map();

  const add = (raw) => {
    if (!raw || typeof raw !== "object") return;
    const sponsorId = raw.sponsorId || raw.id;
    if (!sponsorId || byId.has(sponsorId)) return;
    const displayName = raw.displayName || raw.name || sponsorId;
    byId.set(sponsorId, { sponsorId, displayName });
  };

  // Primary source: the sponsors array (associateMultipleSponsors write path).
  if (Array.isArray(instance?.sponsors)) {
    instance.sponsors.forEach(add);
  }
  // Backward-compat primary written by associateSponsor/updateSponsor.
  add(instance?.sponsorBranding);
  // Further fallback: the singular sponsor object SponsorManagement.jsx writes today.
  add(instance?.sponsor);

  return Array.from(byId.values());
}

/**
 * PromotionEditor — isolated editor for a single sponsor promotion. Wrapped in
 * React.memo (like Coupons' OfferEditor / Raffles' PrizeItem) so editing one
 * promotion does not re-render siblings and text fields keep focus across
 * keystrokes. The CTA target value's helper text adapts to the selected
 * targetType (Req 3.3–3.5).
 */
const PromotionEditor = memo(
  ({ promo, idx, count, sponsors, errors, uploading, onUpdate, onDelete, onUploadCreative }) => {
    const headlineValue = promo.headline ?? "";
    const descriptionValue = promo.description ?? "";
    const cta = promo.cta || {};
    const ctaLabelValue = cta.label ?? "";

    const updateField = (key, value) => onUpdate({ ...promo, [key]: value });
    const updateCta = (key, value) => onUpdate({ ...promo, cta: { ...cta, [key]: value } });
    const updateWindow = (key, value) =>
      onUpdate({ ...promo, displayWindow: { ...(promo.displayWindow || {}), [key]: value } });

    const targetHelper =
      cta.targetType === "external-link"
        ? "Absolute https:// URL"
        : cta.targetType === "coupon-offer"
        ? "Coupon offer identifier"
        : "Event detail identifier";

    return (
      <Box
        data-testid={`promotion-editor-${idx}`}
        sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
            Promotion {idx + 1}
          </Typography>
          <IconButton
            size="small"
            aria-label={`Remove promotion ${idx + 1}`}
            onClick={onDelete}
            disabled={count <= LIMITS.MIN_PROMOTIONS}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Linked sponsor (Req 10.3) */}
        <FormControl
          fullWidth
          size="small"
          error={!!errors[`promotions[${idx}].sponsorId`]}
          sx={{ mb: 2 }}
        >
          <InputLabel id={`sponsor-label-${idx}`}>Sponsor</InputLabel>
          <Select
            labelId={`sponsor-label-${idx}`}
            label="Sponsor"
            value={promo.sponsorId || ""}
            onChange={(e) => updateField("sponsorId", e.target.value)}
            inputProps={{ "aria-label": `Sponsor for promotion ${idx + 1}` }}
          >
            {sponsors.map((s) => (
              <MenuItem key={s.sponsorId} value={s.sponsorId}>
                {s.displayName}
              </MenuItem>
            ))}
          </Select>
          {errors[`promotions[${idx}].sponsorId`] && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
              {errors[`promotions[${idx}].sponsorId`]}
            </Typography>
          )}
        </FormControl>

        {/* Creative upload (Req 10.6) */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, color: "#0d1b35" }}>
            Creative (PNG, JPEG, or WebP · max 5 MB)
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
            <Button
              variant="outlined"
              component="label"
              disabled={uploading}
              startIcon={<CloudUploadOutlinedIcon />}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                borderRadius: 2,
                borderColor: errors[`promotions[${idx}].creativeAssetUrl`] ? "#d32f2f" : ACCENT,
                color: ACCENT,
              }}
            >
              {uploading ? "Uploading..." : promo.creativeAssetUrl ? "Replace Creative" : "Upload Creative"}
              <input
                type="file"
                hidden
                accept="image/png,image/jpeg,image/webp"
                aria-label={`Creative for promotion ${idx + 1}`}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadCreative(file);
                  e.target.value = "";
                }}
              />
            </Button>
            {promo.creativeAssetUrl && (
              <Box
                component="img"
                src={promo.creativePreview || promo.creativeAssetUrl}
                alt="Creative preview"
                sx={{ height: 48, maxWidth: 140, objectFit: "contain", borderRadius: 1, border: "1px solid #E5E7EB" }}
              />
            )}
          </Box>
          {(errors[`promotions[${idx}].creativeAssetUrl`] ||
            errors[`promotions[${idx}].creativeMediaType`] ||
            errors[`promotions[${idx}].creativeSizeBytes`]) && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>
              {errors[`promotions[${idx}].creativeAssetUrl`] ||
                errors[`promotions[${idx}].creativeMediaType`] ||
                errors[`promotions[${idx}].creativeSizeBytes`]}
            </Typography>
          )}
        </Box>

        {/* Headline (Req 10.5) */}
        <TextField
          fullWidth
          size="small"
          label="Headline"
          value={headlineValue}
          onChange={(e) => updateField("headline", e.target.value)}
          error={!!errors[`promotions[${idx}].headline`]}
          helperText={errors[`promotions[${idx}].headline`] || `${headlineValue.length}/${LIMITS.MAX_HEADLINE}`}
          inputProps={{ maxLength: LIMITS.MAX_HEADLINE + 1 }}
          sx={{ mb: 2 }}
        />

        {/* Description */}
        <TextField
          fullWidth
          size="small"
          label="Description"
          value={descriptionValue}
          onChange={(e) => updateField("description", e.target.value)}
          error={!!errors[`promotions[${idx}].description`]}
          helperText={errors[`promotions[${idx}].description`] || `${descriptionValue.length}/${LIMITS.MAX_DESCRIPTION}`}
          inputProps={{ maxLength: LIMITS.MAX_DESCRIPTION + 1 }}
          multiline
          minRows={2}
          sx={{ mb: 2 }}
        />

        {/* Call to action group (Req 10.5) */}
        <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, color: "#0d1b35" }}>
          Call to Action
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap", alignItems: "flex-start" }}>
          <TextField
            size="small"
            label="Label"
            value={ctaLabelValue}
            onChange={(e) => updateCta("label", e.target.value)}
            error={!!errors[`promotions[${idx}].cta.label`]}
            helperText={errors[`promotions[${idx}].cta.label`] || `${ctaLabelValue.length}/${LIMITS.MAX_CTA_LABEL}`}
            inputProps={{ maxLength: LIMITS.MAX_CTA_LABEL + 1, "aria-label": `CTA label for promotion ${idx + 1}` }}
            sx={{ flex: 1, minWidth: 180 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }} error={!!errors[`promotions[${idx}].cta.targetType`]}>
            <InputLabel id={`cta-target-type-label-${idx}`}>Target Type</InputLabel>
            <Select
              labelId={`cta-target-type-label-${idx}`}
              label="Target Type"
              value={cta.targetType || "external-link"}
              onChange={(e) => updateCta("targetType", e.target.value)}
              inputProps={{ "aria-label": `CTA target type for promotion ${idx + 1}` }}
            >
              {CTA_TARGET_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>
                  {t.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            label="Target Value"
            value={cta.targetValue ?? ""}
            onChange={(e) => updateCta("targetValue", e.target.value)}
            error={!!errors[`promotions[${idx}].cta.targetValue`]}
            helperText={errors[`promotions[${idx}].cta.targetValue`] || targetHelper}
            inputProps={{ "aria-label": `CTA target value for promotion ${idx + 1}` }}
            sx={{ flex: 1, minWidth: 220 }}
          />
        </Box>

        {/* Placement + display window (Req 10.5) */}
        <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap", alignItems: "flex-start" }}>
          <FormControl size="small" sx={{ minWidth: 180 }} error={!!errors[`promotions[${idx}].placement`]}>
            <InputLabel id={`placement-label-${idx}`}>Placement</InputLabel>
            <Select
              labelId={`placement-label-${idx}`}
              label="Placement"
              value={promo.placement || "feed-card"}
              onChange={(e) => updateField("placement", e.target.value)}
              inputProps={{ "aria-label": `Placement for promotion ${idx + 1}` }}
            >
              {PLACEMENT_OPTIONS.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            type="datetime-local"
            label="Display Start"
            value={promo.displayWindow?.start ?? ""}
            onChange={(e) => updateWindow("start", e.target.value)}
            error={!!errors[`promotions[${idx}].displayWindow.start`]}
            helperText={errors[`promotions[${idx}].displayWindow.start`] || " "}
            InputLabelProps={{ shrink: true }}
            inputProps={{ "aria-label": `Display start for promotion ${idx + 1}` }}
            sx={{ width: 220 }}
          />
          <TextField
            size="small"
            type="datetime-local"
            label="Display End"
            value={promo.displayWindow?.end ?? ""}
            onChange={(e) => updateWindow("end", e.target.value)}
            error={!!errors[`promotions[${idx}].displayWindow.end`]}
            helperText={errors[`promotions[${idx}].displayWindow.end`] || " "}
            InputLabelProps={{ shrink: true }}
            inputProps={{ "aria-label": `Display end for promotion ${idx + 1}` }}
            sx={{ width: 220 }}
          />
        </Box>

        {/* Optional goals (Req 10.5) */}
        <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
          <TextField
            size="small"
            type="number"
            label="Impression Goal (optional)"
            value={promo.impressionGoal ?? ""}
            onChange={(e) => updateField("impressionGoal", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
            error={!!errors[`promotions[${idx}].impressionGoal`]}
            helperText={errors[`promotions[${idx}].impressionGoal`] || " "}
            inputProps={{
              min: LIMITS.MIN_GOAL,
              max: LIMITS.MAX_GOAL,
              "aria-label": `Impression goal for promotion ${idx + 1}`,
            }}
            sx={{ width: 240 }}
          />
          <TextField
            size="small"
            type="number"
            label="Engagement Goal (optional)"
            value={promo.engagementGoal ?? ""}
            onChange={(e) => updateField("engagementGoal", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
            error={!!errors[`promotions[${idx}].engagementGoal`]}
            helperText={errors[`promotions[${idx}].engagementGoal`] || " "}
            inputProps={{
              min: LIMITS.MIN_GOAL,
              max: LIMITS.MAX_GOAL,
              "aria-label": `Engagement goal for promotion ${idx + 1}`,
            }}
            sx={{ width: 240 }}
          />
        </Box>
      </Box>
    );
  }
);

PromotionEditor.displayName = "PromotionEditor";

/**
 * SponsorPromotionConfig — organizer-facing configuration screen for a Sponsor
 * Promotions experience instance. Mirrors CouponConfig/RaffleConfig's stepped MUI
 * form: memoized promotion editors preserving input focus, an errors map keyed by
 * field path, client-side validation reproducing the plugin rules (1.2–4.5), and a
 * save that persists the config via updateInstance shaped as { promotions:[...] }.
 *
 * Sponsor integration: on mount getInstance loads the existing sponsor set
 * (instance.sponsors + the sponsorBranding primary), normalized/de-duped by
 * sponsorId. When the set is empty the "Add Promotion" control is hidden and the
 * organizer is prompted to create a sponsor in the SponsorManagement screen.
 *
 * Creative upload path: the "request_upload" action is issued through the shared
 * participate() service (POST /participate with submissionData:{ action, sponsorId,
 * declaredType }); the returned presigned URL is PUT with the raw file, and the
 * returned creativeAssetUrl is stored on the promotion.
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8
 */
const SponsorPromotionConfig = () => {
  const { eventId, experienceId } = useParams();
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [sponsors, setSponsors] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [, setSaved] = useState(false);
  // Track per-promotion upload in flight (keyed by promotionId) and upload errors.
  const [uploadingId, setUploadingId] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  const sponsorIds = new Set(sponsors.map((s) => s.sponsorId));
  const hasSponsors = sponsors.length > 0;

  // Convert a stored ISO timestamp to the value a datetime-local input expects
  // (YYYY-MM-DDTHH:mm, local time). Empty/invalid inputs map to "".
  const toLocalInput = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Load the sponsor set and any existing promotion config so the organizer edits
  // rather than overwrites.
  useEffect(() => {
    if (!eventId || !experienceId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getInstance(eventId, experienceId);
        const instance = res.data?.data || res.data || {};
        if (cancelled) return;

        setSponsors(normalizeSponsors(instance));

        const cfg = instance?.config;
        if (cfg?.promotions?.length) {
          setForm({
            accentColor: cfg.accentColor || DEFAULT_ACCENT,
            promotions: cfg.promotions.map((p, pi) => ({
              promotionId: p.promotionId || `promo-${pi}`,
              sponsorId: p.sponsorId ?? "",
              creativeAssetUrl: p.creativeAssetUrl ?? "",
              creativeMediaType: p.creativeMediaType ?? "",
              creativeSizeBytes: p.creativeSizeBytes ?? 0,
              headline: p.headline ?? "",
              description: p.description ?? "",
              cta: {
                label: p.cta?.label ?? "",
                targetType: p.cta?.targetType ?? "external-link",
                targetValue: p.cta?.targetValue ?? "",
              },
              placement: p.placement ?? "feed-card",
              displayWindow: {
                start: toLocalInput(p.displayWindow?.start),
                end: toLocalInput(p.displayWindow?.end),
              },
              impressionGoal: p.impressionGoal ?? "",
              engagementGoal: p.engagementGoal ?? "",
            })),
          });
        }
      } catch (err) {
        // Non-fatal: a brand-new instance has no config yet.
        console.log("SponsorPromotionConfig: no existing config", err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, experienceId]);

  // ── Promotion mutations ─────────────────────────────────────────────────────
  const updatePromotion = (idx, updated) => {
    setForm((prev) => ({
      ...prev,
      promotions: prev.promotions.map((p, i) => (i === idx ? updated : p)),
    }));
    setSaved(false);
  };

  const addPromotion = () => {
    setForm((prev) =>
      prev.promotions.length >= LIMITS.MAX_PROMOTIONS
        ? prev
        : { ...prev, promotions: [...prev.promotions, makePromotion()] }
    );
    setSaved(false);
  };

  const removePromotion = (idx) => {
    setForm((prev) => {
      if (prev.promotions.length <= LIMITS.MIN_PROMOTIONS) return prev;
      return { ...prev, promotions: prev.promotions.filter((_, i) => i !== idx) };
    });
    setSaved(false);
  };

  /**
   * Uploads a creative for the promotion at `idx`. Validates type/size client-side
   * against the plugin's allow-list, then requests an Upload_Ticket through the
   * participate service (action: 'request_upload'), PUTs the raw file to the
   * returned presigned URL, and stores the returned creativeAssetUrl plus the
   * media type/size and a local preview.
   */
  const handleUploadCreative = async (idx, file) => {
    const promo = form.promotions[idx];
    setUploadError(null);

    // Client-side pre-validation (Req 10.6): type ∈ allow-list and size ≤ max.
    if (!CREATIVE_MEDIA_TYPES.includes(file.type)) {
      setUploadError("Creative must be a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > LIMITS.MAX_CREATIVE_BYTES) {
      setUploadError("Creative must be 5 MB or smaller.");
      return;
    }
    if (!promo?.sponsorId) {
      setUploadError("Select a sponsor before uploading a creative.");
      return;
    }

    setUploadingId(promo.promotionId);
    try {
      // Request the upload ticket through the participate route. The backend
      // handleParticipation reads action/sponsorId/declaredType off the submission.
      const res = await participate(eventId, experienceId, {
        channel: "organizer",
        submissionData: {
          action: "request_upload",
          sponsorId: promo.sponsorId,
          declaredType: file.type,
        },
      });
      const ticket = res.data?.data || res.data || {};
      const { presignedUrl, creativeAssetUrl, allowedFileTypes, maxFileSize } = ticket;

      if (!presignedUrl || !creativeAssetUrl) {
        setUploadError("Could not obtain an upload URL. Please try again.");
        return;
      }
      // Honor server-declared constraints when present.
      if (Array.isArray(allowedFileTypes) && !allowedFileTypes.includes(file.type)) {
        setUploadError("Creative type is not allowed.");
        return;
      }
      if (typeof maxFileSize === "number" && file.size > maxFileSize) {
        setUploadError("Creative exceeds the maximum allowed size.");
        return;
      }

      const uploadRes = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!uploadRes.ok) {
        setUploadError("Uploading the creative failed. Please try again.");
        return;
      }

      const preview = URL.createObjectURL(file);
      updatePromotion(idx, {
        ...form.promotions[idx],
        creativeAssetUrl,
        creativeMediaType: file.type,
        creativeSizeBytes: file.size,
        creativePreview: preview,
      });
    } catch (err) {
      setUploadError(err.response?.data?.message || err.message || "Creative upload failed.");
    } finally {
      setUploadingId(null);
    }
  };

  const handleSave = async () => {
    const allErrors = validateAll(form, sponsorIds);
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
        promotions: form.promotions.map((p) => {
          const promotion = {
            promotionId: p.promotionId,
            sponsorId: p.sponsorId,
            creativeAssetUrl: p.creativeAssetUrl,
            creativeMediaType: p.creativeMediaType,
            creativeSizeBytes: Number(p.creativeSizeBytes),
            headline: p.headline.trim(),
            description: (p.description || "").trim(),
            cta: {
              label: p.cta.label.trim(),
              targetType: p.cta.targetType,
              targetValue: (p.cta.targetValue || "").trim(),
            },
            placement: p.placement,
            displayWindow: {
              start: new Date(p.displayWindow.start).toISOString(),
              end: new Date(p.displayWindow.end).toISOString(),
            },
          };
          // Omitted goals stay unset (Req 4.5) rather than being sent as empty.
          if (goalProvided(p.impressionGoal)) promotion.impressionGoal = Number(p.impressionGoal);
          if (goalProvided(p.engagementGoal)) promotion.engagementGoal = Number(p.engagementGoal);
          return promotion;
        }),
      };
      await updateInstance(eventId, experienceId, { config });
      setSaved(true);
      // Return to the engagements dashboard after a successful save (matches Raffle).
      navigate(`/admin/my-events/${eventId}/experiences`);
    } catch (err) {
      setSaveError(
        err.response?.data?.message || err.message || "Failed to save sponsor promotion configuration."
      );
    } finally {
      setSaving(false);
    }
  };

  const goToSponsorManagement = () =>
    navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/sponsors`);

  const renderPromotionsStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Promotions ({form.promotions.length}/{LIMITS.MAX_PROMOTIONS})
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Author each sponsor promotion: link a sponsor, upload a creative, and set the headline, call to action, placement, display window, and optional goals.
      </Typography>

      <ThemeColorPicker
        value={form.accentColor}
        onChange={(hex) => {
          setForm((prev) => ({ ...prev, accentColor: hex }));
          setSaved(false);
        }}
        helper="Accent color used across this sponsor promotion's display"
      />

      {/* Empty sponsor set: prompt to Sponsor Management and block adding promotions (Req 10.4) */}
      {!hasSponsors ? (
        <Alert
          severity="info"
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={goToSponsorManagement} sx={{ textTransform: "none", fontWeight: 700 }}>
              Manage Sponsors
            </Button>
          }
        >
          No sponsors are associated with this experience yet. Add a sponsor in Sponsor Management before creating promotions.
        </Alert>
      ) : (
        <>
          {errors["promotions"] && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {errors["promotions"]}
            </Alert>
          )}
          {uploadError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setUploadError(null)}>
              {uploadError}
            </Alert>
          )}

          {form.promotions.map((promo, idx) => (
            <PromotionEditor
              key={promo.promotionId}
              promo={promo}
              idx={idx}
              count={form.promotions.length}
              sponsors={sponsors}
              errors={errors}
              uploading={uploadingId === promo.promotionId}
              onUpdate={(updated) => updatePromotion(idx, updated)}
              onDelete={() => removePromotion(idx)}
              onUploadCreative={(file) => handleUploadCreative(idx, file)}
            />
          ))}

          <Button
            startIcon={<AddIcon />}
            onClick={addPromotion}
            disabled={form.promotions.length >= LIMITS.MAX_PROMOTIONS}
            variant="outlined"
            sx={{ textTransform: "none", borderColor: ACCENT, color: ACCENT }}
          >
            Add Promotion
          </Button>
        </>
      )}
    </Box>
  );

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Review & Save
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Review your promotions, then save the configuration to this experience.
      </Typography>

      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#F8F9FA" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>
          {form.promotions.length} promotion{form.promotions.length === 1 ? "" : "s"}
        </Typography>
        {form.promotions.map((promo, idx) => {
          const sponsor = sponsors.find((s) => s.sponsorId === promo.sponsorId);
          return (
            <Typography key={promo.promotionId} sx={{ fontSize: 13, color: "#374151" }}>
              {idx + 1}. {promo.headline || `Promotion ${idx + 1}`}{" "}
              <Typography component="span" sx={{ fontSize: 12, color: "#6B7280" }}>
                ({sponsor?.displayName || "no sponsor"} · {promo.placement})
              </Typography>
            </Typography>
          );
        })}
      </Box>

    </Box>
  );

  const renderStep = () => {
    if (activeStep === 0) return renderPromotionsStep();
    return renderReviewStep();
  };

  return (
    <EngagementConfigShell
      title="Configure Sponsor Promotions"
      subtitle="Author sponsored promotions delivered to attendees, each linked to an existing sponsor."
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
      saving={saving || !hasSponsors}
      errorText={saveError}
    >
      {renderStep()}
    </EngagementConfigShell>
  );
};

export default SponsorPromotionConfig;
