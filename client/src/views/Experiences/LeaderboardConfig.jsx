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
import { getInstance, updateInstance, listInstances } from "../../services/experienceService";
import ThemeColorPicker from "./ThemeColorPicker";
import EngagementConfigShell from "./EngagementConfigShell";

const ACCENT = "#22C55E"; // Games & Challenges brand color
const DEFAULT_ACCENT = "#22C55E";

// Config bounds — mirror the plugin's validateConfig rules (Requirements 1.2–1.9).
const LIMITS = {
  MIN_SOURCES: 0,
  MAX_SOURCES: 20,
  MIN_WEIGHT: 0,
  MAX_WEIGHT: 1000,
  DEFAULT_WEIGHT: 1,
  MIN_DISPLAY_SIZE: 1,
  MAX_DISPLAY_SIZE: 1000,
};

// The only supported aggregation mode (Requirement 1.6).
const AGGREGATION_MODE = "sum";

// Tie-break rules (Requirement 1.8, 5.1–5.3).
const TIE_BREAK_OPTIONS = [
  { value: "shared-rank", label: "Shared rank — tied attendees share a rank" },
  {
    value: "earliest-contribution",
    label: "Earliest contribution — ordered by earliest contribution time",
  },
];
const TIE_BREAK_SET = new Set(TIE_BREAK_OPTIONS.map((o) => o.value));
const DEFAULT_TIE_BREAK = "shared-rank";

// Experience types whose participation emits points/scores that can feed a
// leaderboard. Non-point-emitting types (surveys, social-wall, pulse-feedback,
// sponsor-promotions, digital-coupons) and the leaderboard itself are excluded
// from the available-sources selector (Req 1.4 same-event membership).
const POINT_EMITTING_TYPES = new Set([
  "loyalty-rewards",
  "check-in-challenges",
  "trivia-challenges",
  "prediction-challenges",
  "treasure-hunts",
  "digital-scratch-offs",
  "instant-win",
  "live-polls",
  "photo-contests",
  "raffles",
]);

const STEPS = ["Sources", "Scoring & Display", "Review & Save"];

/**
 * Humanizes an experienceType key ("prediction-challenges") into a display
 * label ("Prediction Challenges"). Mirrors the type pill on ExperienceCard.
 */
const humanizeType = (type) =>
  typeof type === "string" && type.length
    ? type
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "";

/**
 * A short, human-friendly id fragment used to disambiguate sources that would
 * otherwise render identically (e.g. three raffles all named "Raffles").
 */
const shortId = (id) => (typeof id === "string" && id.length ? id.slice(-6) : "");

/**
 * Builds the display label for a source option. When several available sources
 * would render with the same base label (same/blank name), each is disambiguated
 * so the organizer can tell them apart:
 *   - the humanized experience type is appended when it isn't already the label
 *   - a short id fragment (#xxxxxx) is appended as a last-resort tiebreaker
 *
 * @param {object} source - { experienceId, name, experienceType }
 * @param {Map<string, number>} baseCounts - how many sources share each base label
 */
const buildSourceLabel = (source, baseCounts) => {
  const typeLabel = humanizeType(source?.experienceType);
  const base = source?.name || typeLabel || source?.experienceId || "";
  const isDuplicate = (baseCounts.get(base) || 0) > 1;
  if (!isDuplicate) return base;

  const parts = [base];
  // Add the type only when it adds information beyond the base label.
  if (typeLabel && typeLabel !== base) parts.push(typeLabel);
  const frag = shortId(source?.experienceId);
  if (frag) parts.push(`#${frag}`);
  return parts.join(" · ");
};

/**
 * Precomputes, for a list of available sources, a map from each source's
 * experienceId to its (possibly disambiguated) display label.
 */
const buildSourceLabels = (sources) => {
  const baseCounts = new Map();
  sources.forEach((s) => {
    const base = s?.name || humanizeType(s?.experienceType) || s?.experienceId || "";
    baseCounts.set(base, (baseCounts.get(base) || 0) + 1);
  });
  const labels = new Map();
  sources.forEach((s) => {
    labels.set(s.experienceId, buildSourceLabel(s, baseCounts));
  });
  return labels;
};

const makeSource = () => ({ sourceExperienceId: "", weight: LIMITS.DEFAULT_WEIGHT });

const DEFAULT_FORM = {
  accentColor: DEFAULT_ACCENT,
  sources: [], // Zero sources selects Manual_Mode (Req 8.4).
  aggregationMode: AGGREGATION_MODE,
  displaySize: 10,
  tieBreak: DEFAULT_TIE_BREAK,
};

/**
 * Validates the leaderboard configuration form, reproducing the backend plugin
 * rules (Requirements 1.2–1.9) into an errors map keyed by field path (e.g.
 * `sources[2].weight`) so each control can surface its own error. Returns an
 * object of { fieldPath: message }. The plugin's validateConfig remains the
 * server-side authority.
 *
 * @param {object} form - the current form state
 * @param {string[]|Set<string>} [availableSourceIds] - the same-event
 *   point-emitting experience ids. When provided, each source must reference a
 *   member of this set (Req 1.4). When omitted, the membership check is skipped
 *   (structural-only) but the non-empty-string requirement still applies.
 */
export function validateAll(form, availableSourceIds) {
  const errors = {};
  const sources = form?.sources || [];
  const isInt = (n) => Number.isInteger(n);

  const availableSet =
    availableSourceIds instanceof Set
      ? availableSourceIds
      : Array.isArray(availableSourceIds)
        ? new Set(availableSourceIds)
        : null;

  // ── sources count (Rule 1.2): 0–20 ─────────────────────────────────────────
  if (sources.length < LIMITS.MIN_SOURCES || sources.length > LIMITS.MAX_SOURCES) {
    errors["sources"] = `Source count must be between ${LIMITS.MIN_SOURCES} and ${LIMITS.MAX_SOURCES} inclusive.`;
  }

  // Track the first index each sourceExperienceId was seen, to flag the LATER
  // (duplicate) index (Rule 1.5).
  const idFirstSeen = new Map();

  sources.forEach((source, idx) => {
    // Rule 1.3 — weight is a number (not NaN) in [0, 1000].
    const weight = Number(source?.weight);
    if (
      source?.weight === "" ||
      source?.weight === null ||
      source?.weight === undefined ||
      Number.isNaN(weight) ||
      weight < LIMITS.MIN_WEIGHT ||
      weight > LIMITS.MAX_WEIGHT
    ) {
      errors[`sources[${idx}].weight`] =
        `Source weight must be a number between ${LIMITS.MIN_WEIGHT} and ${LIMITS.MAX_WEIGHT} inclusive.`;
    }

    // Rule 1.4 — sourceExperienceId non-empty string, then same-event membership.
    const sourceExperienceId = source?.sourceExperienceId;
    if (typeof sourceExperienceId !== "string" || sourceExperienceId.length < 1) {
      errors[`sources[${idx}].sourceExperienceId`] = "Select a source experience.";
    } else {
      if (availableSet && !availableSet.has(sourceExperienceId)) {
        errors[`sources[${idx}].sourceExperienceId`] =
          "Source experience must reference an experience in the same event.";
      }

      // Rule 1.5 — duplicate flagged at the later index.
      if (idFirstSeen.has(sourceExperienceId)) {
        errors[`sources[${idx}].sourceExperienceId`] =
          `Duplicate source; each source may appear only once.`;
      } else {
        idFirstSeen.set(sourceExperienceId, idx);
      }
    }
  });

  // ── displaySize (Rule 1.7): integer 1–1000 ────────────────────────────────
  const displaySize = Number(form?.displaySize);
  if (
    !isInt(displaySize) ||
    displaySize < LIMITS.MIN_DISPLAY_SIZE ||
    displaySize > LIMITS.MAX_DISPLAY_SIZE
  ) {
    errors["displaySize"] =
      `Display size must be an integer between ${LIMITS.MIN_DISPLAY_SIZE} and ${LIMITS.MAX_DISPLAY_SIZE} inclusive.`;
  }

  // ── tieBreak (Rule 1.8): membership ────────────────────────────────────────
  if (!TIE_BREAK_SET.has(form?.tieBreak)) {
    errors["tieBreak"] = "Select a valid tie-break rule.";
  }

  return errors;
}

/**
 * SourceRow — isolated editor for a single Source_Config (source selector +
 * weight). Wrapped in React.memo (like LoyaltyConfig's RewardItem) so editing
 * one row does not re-render siblings and inputs keep focus across keystrokes
 * (Requirement 10.2).
 */
const SourceRow = memo(({ source, idx, availableSources, sourceLabels, errors, onUpdate, onRemove }) => {
  const idError = errors[`sources[${idx}].sourceExperienceId`];
  const weightError = errors[`sources[${idx}].weight`];

  const updateField = (key, value) => onUpdate({ ...source, [key]: value });

  const updateNumber = (raw) => {
    const value = raw === "" ? "" : Number(raw);
    onUpdate({ ...source, weight: value });
  };

  return (
    <Box
      data-testid={`source-row-${idx}`}
      sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
          Source {idx + 1}
        </Typography>
        <IconButton
          size="small"
          aria-label={`Remove source ${idx + 1}`}
          data-testid={`remove-source-${idx}`}
          onClick={() => onRemove(idx)}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "flex-start" }}>
        <FormControl size="small" sx={{ minWidth: 280 }} error={!!idError}>
          <InputLabel id={`source-select-label-${idx}`}>Source experience</InputLabel>
          <Select
            labelId={`source-select-label-${idx}`}
            label="Source experience"
            value={source.sourceExperienceId || ""}
            onChange={(e) => updateField("sourceExperienceId", e.target.value)}
            inputProps={{
              "aria-label": `Source experience for source ${idx + 1}`,
              "data-testid": `source-select-${idx}`,
            }}
          >
            {availableSources.length === 0 && (
              <MenuItem value="" disabled>
                No point-emitting experiences in this event
              </MenuItem>
            )}
            {availableSources.map((s) => (
              <MenuItem key={s.experienceId} value={s.experienceId}>
                {sourceLabels?.get(s.experienceId) ||
                  s.name ||
                  humanizeType(s.experienceType) ||
                  s.experienceId}
              </MenuItem>
            ))}
          </Select>
          {idError && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
              {idError}
            </Typography>
          )}
        </FormControl>

        <TextField
          size="small"
          type="number"
          label="Weight"
          value={source.weight ?? ""}
          onChange={(e) => updateNumber(e.target.value)}
          error={!!weightError}
          helperText={weightError || `${LIMITS.MIN_WEIGHT}–${LIMITS.MAX_WEIGHT} (default ${LIMITS.DEFAULT_WEIGHT})`}
          inputProps={{
            min: LIMITS.MIN_WEIGHT,
            max: LIMITS.MAX_WEIGHT,
            "aria-label": `Weight for source ${idx + 1}`,
            "data-testid": `source-weight-${idx}`,
          }}
          sx={{ width: 200 }}
        />
      </Box>
    </Box>
  );
});

SourceRow.displayName = "SourceRow";

/**
 * LeaderboardConfig — organizer-facing configuration screen for a Leaderboards
 * experience instance. Mirrors LoyaltyConfig/SocialWallConfig's stepped MUI
 * form: memoized editors preserving input focus, an errors map keyed by field
 * path, client-side validation reproducing the plugin rules (1.2–1.9), and a
 * save that persists the config via updateInstance. Zero sources selects
 * Manual_Mode; one or more selects Aggregation_Mode.
 */
const LeaderboardConfig = () => {
  const { eventId, experienceId } = useParams();
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [availableSources, setAvailableSources] = useState([]);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [, setSaved] = useState(false);

  // Load the OTHER point-emitting experiences in this event so the organizer can
  // pick sources. Failures are tolerated — the selector simply shows empty.
  useEffect(() => {
    if (!eventId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await listInstances(eventId);
        const raw =
          res?.data?.data?.instances ||
          res?.data?.data ||
          res?.data?.instances ||
          res?.data ||
          [];
        const list = Array.isArray(raw) ? raw : [];
        const sources = list
          .filter((i) => i && (i.experienceId || i.id))
          .map((i) => ({
            experienceId: i.experienceId || i.id,
            name: i.name,
            experienceType: i.experienceType,
          }))
          .filter(
            (i) => i.experienceId !== experienceId && POINT_EMITTING_TYPES.has(i.experienceType)
          );
        if (!cancelled) setAvailableSources(sources);
      } catch (err) {
        // Non-fatal: gracefully show an empty selector.
        console.log("LeaderboardConfig: could not load available sources", err?.message);
        if (!cancelled) setAvailableSources([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, experienceId]);

  // Load any existing config so the organizer edits rather than overwrites.
  useEffect(() => {
    if (!eventId || !experienceId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await getInstance(eventId, experienceId);
        const instance = res.data?.data || res.data;
        const cfg = instance?.config;
        if (!cancelled && cfg && (cfg.sources || cfg.displaySize || cfg.tieBreak || cfg.accentColor)) {
          setForm({
            accentColor: cfg.accentColor || DEFAULT_ACCENT,
            sources: Array.isArray(cfg.sources)
              ? cfg.sources.map((s) => ({
                  sourceExperienceId: s?.sourceExperienceId ?? "",
                  weight: s?.weight ?? LIMITS.DEFAULT_WEIGHT,
                }))
              : [],
            aggregationMode: AGGREGATION_MODE,
            displaySize: cfg.displaySize ?? 10,
            tieBreak: TIE_BREAK_SET.has(cfg.tieBreak) ? cfg.tieBreak : DEFAULT_TIE_BREAK,
          });
        }
      } catch (err) {
        // Non-fatal: a brand-new instance has no config yet.
        console.log("LeaderboardConfig: no existing config", err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, experienceId]);

  const availableSourceIds = availableSources.map((s) => s.experienceId);

  // Disambiguated display labels keyed by experienceId. Sources that would
  // otherwise render identically (e.g. several raffles named "Raffles") get a
  // type + short-id suffix so the organizer can tell them apart.
  const sourceLabels = buildSourceLabels(availableSources);

  // ── Source mutations ─────────────────────────────────────────────────────────
  const updateSource = (idx, updated) => {
    setForm((prev) => ({
      ...prev,
      sources: prev.sources.map((s, i) => (i === idx ? updated : s)),
    }));
    setSaved(false);
  };

  const addSource = () => {
    setForm((prev) =>
      prev.sources.length >= LIMITS.MAX_SOURCES
        ? prev
        : { ...prev, sources: [...prev.sources, makeSource()] }
    );
    setSaved(false);
  };

  const removeSource = (idx) => {
    setForm((prev) => ({ ...prev, sources: prev.sources.filter((_, i) => i !== idx) }));
    setSaved(false);
  };

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const updateNumberField = (key, raw) => {
    const value = raw === "" ? "" : parseInt(raw, 10);
    updateField(key, value);
  };

  const handleSave = async () => {
    const allErrors = validateAll(form, availableSourceIds.length ? availableSourceIds : undefined);
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
        sources: form.sources.map((s) => ({
          sourceExperienceId: s.sourceExperienceId,
          weight: Number(s.weight),
        })),
        aggregationMode: AGGREGATION_MODE,
        displaySize: Number(form.displaySize),
        tieBreak: form.tieBreak,
      };
      await updateInstance(eventId, experienceId, { config });
      setSaved(true);
      navigate(`/admin/my-events/${eventId}/experiences`);
    } catch (err) {
      setSaveError(
        err.response?.data?.message || err.message || "Failed to save leaderboard configuration."
      );
    } finally {
      setSaving(false);
    }
  };

  const renderSourcesStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Sources ({form.sources.length}/{LIMITS.MAX_SOURCES})
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Choose the point-emitting experiences in this event whose scores feed this leaderboard.
        Each source has a weight applied before scores are summed.
      </Typography>

      <ThemeColorPicker
        value={form.accentColor}
        onChange={(hex) => {
          setForm((prev) => ({ ...prev, accentColor: hex }));
          setSaved(false);
        }}
        helper="Sets the accent color attendees see on the leaderboard screen."
      />

      {errors["sources"] && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {errors["sources"]}
        </Alert>
      )}

      {form.sources.length === 0 && (
        <Alert
          severity="info"
          data-testid="manual-mode-indicator"
          sx={{ mb: 2, borderRadius: 2 }}
        >
          No sources selected. This leaderboard will operate in Manual Mode and accept direct point
          awards through the ingestion contract. Add a source to switch to automatic score
          aggregation.
        </Alert>
      )}

      {form.sources.map((source, idx) => (
        <SourceRow
          // Row identity is positional; sources have no stable id.
          key={`source-${idx}`}
          source={source}
          idx={idx}
          availableSources={availableSources}
          sourceLabels={sourceLabels}
          errors={errors}
          onUpdate={(updated) => updateSource(idx, updated)}
          onRemove={removeSource}
        />
      ))}

      <Button
        startIcon={<AddIcon />}
        onClick={addSource}
        disabled={form.sources.length >= LIMITS.MAX_SOURCES}
        data-testid="add-source-button"
        variant="outlined"
        sx={{ textTransform: "none", borderColor: ACCENT, color: ACCENT }}
      >
        Add Source
      </Button>
    </Box>
  );

  const renderScoringStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Scoring & Display
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Set how many ranked entries to show, how ties are broken, and how per-source scores combine.
      </Typography>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
        <TextField
          size="small"
          type="number"
          label="Display size"
          value={form.displaySize ?? ""}
          onChange={(e) => updateNumberField("displaySize", e.target.value)}
          error={!!errors["displaySize"]}
          helperText={
            errors["displaySize"] ||
            `${LIMITS.MIN_DISPLAY_SIZE}–${LIMITS.MAX_DISPLAY_SIZE} ranked entries (top-N)`
          }
          inputProps={{
            min: LIMITS.MIN_DISPLAY_SIZE,
            max: LIMITS.MAX_DISPLAY_SIZE,
            "aria-label": "Display size",
            "data-testid": "display-size-input",
          }}
          sx={{ width: 240 }}
        />

        <FormControl size="small" sx={{ minWidth: 320 }} error={!!errors["tieBreak"]}>
          <InputLabel id="tie-break-label">Tie-break rule</InputLabel>
          <Select
            labelId="tie-break-label"
            label="Tie-break rule"
            value={form.tieBreak}
            onChange={(e) => updateField("tieBreak", e.target.value)}
            inputProps={{ "aria-label": "Tie-break rule", "data-testid": "tie-break-input" }}
          >
            {TIE_BREAK_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
          {errors["tieBreak"] && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
              {errors["tieBreak"]}
            </Typography>
          )}
        </FormControl>
      </Box>

      {/* Aggregation mode is read-only — `sum` is the only supported mode (Req 1.6). */}
      <FormControl size="small" sx={{ minWidth: 320 }} data-testid="aggregation-mode">
        <InputLabel id="aggregation-mode-label">Aggregation mode</InputLabel>
        <Select
          labelId="aggregation-mode-label"
          label="Aggregation mode"
          value={AGGREGATION_MODE}
          readOnly
          inputProps={{ "aria-label": "Aggregation mode" }}
        >
          <MenuItem value={AGGREGATION_MODE}>Weighted sum</MenuItem>
        </Select>
        <Typography variant="caption" sx={{ mt: 0.5, ml: 1.5, color: "#6B7280" }}>
          Scores combine as a weighted sum across configured sources.
        </Typography>
      </FormControl>
    </Box>
  );

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Review & Save
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Review your leaderboard configuration, then save it to this experience.
      </Typography>

      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#F8F9FA" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>
          {form.sources.length === 0
            ? "Manual Mode — direct point awards"
            : `Aggregation Mode — ${form.sources.length} source${
                form.sources.length === 1 ? "" : "s"
              }`}
        </Typography>
        {form.sources.map((source, idx) => {
          const label =
            sourceLabels.get(source.sourceExperienceId) ||
            source.sourceExperienceId ||
            `Source ${idx + 1}`;
          return (
            <Typography key={`review-source-${idx}`} sx={{ fontSize: 13, color: "#374151" }}>
              {idx + 1}. {label}{" "}
              <Typography component="span" sx={{ fontSize: 12, color: "#6B7280" }}>
                (weight {source.weight})
              </Typography>
            </Typography>
          );
        })}
        <Typography sx={{ fontSize: 13, color: "#374151", mt: 1 }}>
          Display size: {form.displaySize} · Tie-break: {form.tieBreak} · Aggregation:{" "}
          {AGGREGATION_MODE}
        </Typography>
      </Box>

    </Box>
  );

  const renderStep = () => {
    if (activeStep === 0) return renderSourcesStep();
    if (activeStep === 1) return renderScoringStep();
    return renderReviewStep();
  };

  return (
    <EngagementConfigShell
      title="Configure Leaderboard"
      subtitle="Rank attendees by combined score across the experiences you choose."
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

export default LeaderboardConfig;
