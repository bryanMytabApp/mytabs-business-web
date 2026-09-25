import React, { useState, useEffect, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  ListItemText,
  OutlinedInput,
} from "@mui/material";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import { getInstance, updateInstance } from "../../services/experienceService";
import ThemeColorPicker from "./ThemeColorPicker";
import EngagementConfigShell from "./EngagementConfigShell";

const ACCENT = "#EC4899"; // Social & Community brand color (CATEGORY_COLORS)
const DEFAULT_ACCENT = "#EC4899"; // default theme color saved when none chosen

// Config limits — mirror the plugin's validateConfig rules (Requirement 1.2–1.10).
const LIMITS = {
  MIN_SUBMISSIONS_PER_ATTENDEE: 1,
  MAX_SUBMISSIONS_PER_ATTENDEE: 100,
  MIN_VOTES_PER_ATTENDEE: 1,
  MAX_VOTES_PER_ATTENDEE: 1000,
  MIN_FILE_SIZE: 1,
  MAX_FILE_SIZE: 26214400, // 25 MiB, in bytes
  MIN_WINNERS: 1,
  MAX_WINNERS: 100,
};

// The permitted image MIME types (Requirement 1.8).
const ALLOWED_FILE_TYPE_OPTIONS = [
  { value: "image/jpeg", label: "JPEG (image/jpeg)" },
  { value: "image/png", label: "PNG (image/png)" },
  { value: "image/webp", label: "WebP (image/webp)" },
  { value: "image/heic", label: "HEIC (image/heic)" },
];
const ALLOWED_FILE_TYPE_SET = new Set(ALLOWED_FILE_TYPE_OPTIONS.map((o) => o.value));

// Moderation modes (Requirement 1.5 / 10.3).
const MODERATION_MODES = [
  { value: "auto_approve", label: "Auto-approve — submissions appear immediately" },
  { value: "require_approval", label: "Require approval — you approve before public display" },
];
const MODERATION_MODE_SET = new Set(MODERATION_MODES.map((m) => m.value));

const STEPS = ["Windows & Moderation", "Limits & Media", "Review & Save"];

const BYTES_PER_MB = 1048576;

const DEFAULT_FORM = {
  accentColor: DEFAULT_ACCENT,
  submissionWindow: { start: null, end: null },
  votingWindow: { start: null, end: null },
  // Default moderation mode mirrors the plugin default (Requirement 1.11).
  moderationMode: "require_approval",
  submissionsPerAttendeeLimit: 3,
  votesPerAttendeeLimit: 20,
  // Self-voting is OFF by default (preserves contest integrity); organizer opt-in.
  allowSelfVote: false,
  allowedMediaConstraints: {
    allowedFileTypes: ["image/jpeg", "image/png", "image/webp"],
    maxFileSize: 10485760, // 10 MiB default
  },
  winnerCount: 3,
};

/**
 * Validates the photo-contest configuration form, reproducing the backend
 * plugin rules (Requirements 1.2–1.10) into an errors map keyed by dotted field
 * path (e.g. `submissionWindow.start`, `allowedMediaConstraints.allowedFileTypes`)
 * so each control can surface its own error. Returns an object of
 * { fieldPath: message }. The plugin's validateConfig remains the server-side
 * authority.
 */
export function validateAll(form) {
  const errors = {};
  const isInt = (n) => Number.isInteger(n);

  const subStart = form?.submissionWindow?.start;
  const subEnd = form?.submissionWindow?.end;
  const voteStart = form?.votingWindow?.start;
  const voteEnd = form?.votingWindow?.end;

  // Dayjs objects expose valueOf(); guard for null/absent values.
  const ms = (d) => (d && typeof d.valueOf === "function" ? d.valueOf() : null);
  const subStartMs = ms(subStart);
  const subEndMs = ms(subEnd);
  const voteStartMs = ms(voteStart);
  const voteEndMs = ms(voteEnd);

  // ── Submission window (Rule 1.2) ─────────────────────────────────────────────
  if (subStartMs === null) {
    errors["submissionWindow.start"] = "Submission start is required.";
  }
  if (subEndMs === null) {
    errors["submissionWindow.end"] = "Submission end is required.";
  }
  if (subStartMs !== null && subEndMs !== null && subStartMs >= subEndMs) {
    errors["submissionWindow.end"] = "Submission end must be after submission start.";
  }

  // ── Voting window (Rule 1.3) ─────────────────────────────────────────────────
  if (voteStartMs === null) {
    errors["votingWindow.start"] = "Voting start is required.";
  }
  if (voteEndMs === null) {
    errors["votingWindow.end"] = "Voting end is required.";
  }
  if (voteStartMs !== null && voteEndMs !== null && voteStartMs >= voteEndMs) {
    errors["votingWindow.end"] = "Voting end must be after voting start.";
  }

  // ── Voting start not before submission start (Rule 1.4) ──────────────────────
  if (
    voteStartMs !== null &&
    subStartMs !== null &&
    voteStartMs < subStartMs &&
    !errors["votingWindow.start"]
  ) {
    errors["votingWindow.start"] = "Voting start must be at or after submission start.";
  }

  // ── Moderation mode membership (Rule 1.5) ────────────────────────────────────
  if (!MODERATION_MODE_SET.has(form?.moderationMode)) {
    errors["moderationMode"] = "Select a valid moderation mode.";
  }

  // ── Submissions-per-attendee limit (Rule 1.6) ────────────────────────────────
  const subLimit = Number(form?.submissionsPerAttendeeLimit);
  if (
    !isInt(subLimit) ||
    subLimit < LIMITS.MIN_SUBMISSIONS_PER_ATTENDEE ||
    subLimit > LIMITS.MAX_SUBMISSIONS_PER_ATTENDEE
  ) {
    errors["submissionsPerAttendeeLimit"] =
      `Submissions per attendee must be an integer between ${LIMITS.MIN_SUBMISSIONS_PER_ATTENDEE} and ${LIMITS.MAX_SUBMISSIONS_PER_ATTENDEE}.`;
  }

  // ── Votes-per-attendee limit (Rule 1.7) ──────────────────────────────────────
  const voteLimit = Number(form?.votesPerAttendeeLimit);
  if (
    !isInt(voteLimit) ||
    voteLimit < LIMITS.MIN_VOTES_PER_ATTENDEE ||
    voteLimit > LIMITS.MAX_VOTES_PER_ATTENDEE
  ) {
    errors["votesPerAttendeeLimit"] =
      `Votes per attendee must be an integer between ${LIMITS.MIN_VOTES_PER_ATTENDEE} and ${LIMITS.MAX_VOTES_PER_ATTENDEE.toLocaleString()}.`;
  }

  // ── Allowed file types (Rule 1.8): non-empty subset of the permitted types ──
  const allowedFileTypes = form?.allowedMediaConstraints?.allowedFileTypes || [];
  if (!Array.isArray(allowedFileTypes) || allowedFileTypes.length < 1) {
    errors["allowedMediaConstraints.allowedFileTypes"] =
      "Select at least one allowed image type.";
  } else if (!allowedFileTypes.every((t) => ALLOWED_FILE_TYPE_SET.has(t))) {
    errors["allowedMediaConstraints.allowedFileTypes"] =
      "Allowed types must be drawn from JPEG, PNG, WebP, and HEIC.";
  }

  // ── Max file size (Rule 1.9): integer 1..26214400 bytes ──────────────────────
  const maxFileSize = Number(form?.allowedMediaConstraints?.maxFileSize);
  if (!isInt(maxFileSize) || maxFileSize < LIMITS.MIN_FILE_SIZE || maxFileSize > LIMITS.MAX_FILE_SIZE) {
    errors["allowedMediaConstraints.maxFileSize"] =
      `Max file size must be an integer between ${LIMITS.MIN_FILE_SIZE} and ${LIMITS.MAX_FILE_SIZE.toLocaleString()} bytes.`;
  }

  // ── Winner count (Rule 1.10): integer 1..100 ─────────────────────────────────
  const winnerCount = Number(form?.winnerCount);
  if (!isInt(winnerCount) || winnerCount < LIMITS.MIN_WINNERS || winnerCount > LIMITS.MAX_WINNERS) {
    errors["winnerCount"] =
      `Winner count must be an integer between ${LIMITS.MIN_WINNERS} and ${LIMITS.MAX_WINNERS}.`;
  }

  return errors;
}

/**
 * WindowFields — isolated editor for one time window (start + end date-time
 * pickers). Wrapped in React.memo (like Raffles' PrizeItem) so editing one
 * window does not re-render siblings and controls keep focus (Requirement 10.2).
 */
const WindowFields = memo(({ prefix, title, startLabel, endLabel, window, errors, onChange }) => {
  const value = window || {};
  return (
    <Box
      data-testid={`window-editor-${prefix}`}
      sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}
    >
      <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13, mb: 1.5 }}>
        {title}
      </Typography>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <DateTimePicker
          label={startLabel}
          value={value.start || null}
          onChange={(val) => onChange("start", val)}
          slotProps={{
            textField: {
              fullWidth: true,
              error: !!errors[`${prefix}.start`],
              helperText: errors[`${prefix}.start`] || " ",
              inputProps: { "aria-label": startLabel },
              "data-testid": `${prefix}-start`,
              sx: { flex: 1, minWidth: 220 },
            },
          }}
        />
        <DateTimePicker
          label={endLabel}
          value={value.end || null}
          onChange={(val) => onChange("end", val)}
          slotProps={{
            textField: {
              fullWidth: true,
              error: !!errors[`${prefix}.end`],
              helperText: errors[`${prefix}.end`] || " ",
              inputProps: { "aria-label": endLabel },
              "data-testid": `${prefix}-end`,
              sx: { flex: 1, minWidth: 220 },
            },
          }}
        />
      </Box>
    </Box>
  );
});

WindowFields.displayName = "WindowFields";

/**
 * PhotoContestConfig — organizer-facing configuration screen for a Photo
 * Contests experience instance. Mirrors RaffleConfig/LoyaltyConfig's stepped
 * MUI form: memoized editors preserving input focus, an errors map keyed by
 * field path, client-side validation reproducing the plugin rules (1.2–1.10),
 * and a save that persists the config via updateInstance. The saved config
 * shapes each window's start/end as ISO strings to match the plugin's
 * PhotoContest_Config.
 */
const PhotoContestConfig = () => {
  const { eventId, experienceId } = useParams();
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [, setSaved] = useState(false);

  // Load any existing config so the organizer edits rather than overwrites.
  useEffect(() => {
    if (!eventId || !experienceId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await getInstance(eventId, experienceId);
        const instance = res.data?.data || res.data;
        const cfg = instance?.config;
        if (!cancelled && cfg && (cfg.submissionWindow || cfg.votingWindow || cfg.winnerCount)) {
          setForm({
            accentColor: cfg.accentColor || DEFAULT_ACCENT,
            submissionWindow: {
              start: cfg.submissionWindow?.start ? dayjs(cfg.submissionWindow.start) : null,
              end: cfg.submissionWindow?.end ? dayjs(cfg.submissionWindow.end) : null,
            },
            votingWindow: {
              start: cfg.votingWindow?.start ? dayjs(cfg.votingWindow.start) : null,
              end: cfg.votingWindow?.end ? dayjs(cfg.votingWindow.end) : null,
            },
            moderationMode: MODERATION_MODE_SET.has(cfg.moderationMode)
              ? cfg.moderationMode
              : "require_approval",
            submissionsPerAttendeeLimit: cfg.submissionsPerAttendeeLimit ?? 3,
            votesPerAttendeeLimit: cfg.votesPerAttendeeLimit ?? 20,
            allowSelfVote: cfg.allowSelfVote === true,
            allowedMediaConstraints: {
              allowedFileTypes:
                cfg.allowedMediaConstraints?.allowedFileTypes?.length
                  ? cfg.allowedMediaConstraints.allowedFileTypes.filter((t) =>
                      ALLOWED_FILE_TYPE_SET.has(t)
                    )
                  : ["image/jpeg", "image/png", "image/webp"],
              maxFileSize: cfg.allowedMediaConstraints?.maxFileSize ?? 10485760,
            },
            winnerCount: cfg.winnerCount ?? 3,
          });
        }
      } catch (err) {
        // Non-fatal: a brand-new instance has no config yet.
        console.log("PhotoContestConfig: no existing config", err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, experienceId]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const updateWindow = (windowKey, field, value) => {
    setForm((prev) => ({
      ...prev,
      [windowKey]: { ...prev[windowKey], [field]: value },
    }));
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

  const updateMedia = (key, value) => {
    setForm((prev) => ({
      ...prev,
      allowedMediaConstraints: { ...prev.allowedMediaConstraints, [key]: value },
    }));
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
        submissionWindow: {
          start: form.submissionWindow.start.toISOString(),
          end: form.submissionWindow.end.toISOString(),
        },
        votingWindow: {
          start: form.votingWindow.start.toISOString(),
          end: form.votingWindow.end.toISOString(),
        },
        moderationMode: form.moderationMode,
        submissionsPerAttendeeLimit: Number(form.submissionsPerAttendeeLimit),
        votesPerAttendeeLimit: Number(form.votesPerAttendeeLimit),
        allowSelfVote: !!form.allowSelfVote,
        allowedMediaConstraints: {
          allowedFileTypes: [...form.allowedMediaConstraints.allowedFileTypes],
          maxFileSize: Number(form.allowedMediaConstraints.maxFileSize),
        },
        winnerCount: Number(form.winnerCount),
      };
      await updateInstance(eventId, experienceId, { config });
      setSaved(true);
      // Return to the engagements dashboard after a successful save (matches Raffle).
      navigate(`/admin/my-events/${eventId}/experiences`);
    } catch (err) {
      setSaveError(
        err.response?.data?.message || err.message || "Failed to save photo contest configuration."
      );
    } finally {
      setSaving(false);
    }
  };

  const renderWindowsStep = () => (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Windows & Moderation
        </Typography>
        <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
          Set when attendees may submit photos and when the community may vote, and choose how
          submissions are moderated before appearing publicly.
        </Typography>

        <ThemeColorPicker
          value={form.accentColor}
          onChange={(hex) => {
            setForm((prev) => ({ ...prev, accentColor: hex }));
            setSaved(false);
          }}
          helper="Accent color used across this photo contest's display"
        />

        <WindowFields
          prefix="submissionWindow"
          title="Submission Window"
          startLabel="Submission start"
          endLabel="Submission end"
          window={form.submissionWindow}
          errors={errors}
          onChange={(field, val) => updateWindow("submissionWindow", field, val)}
        />

        <WindowFields
          prefix="votingWindow"
          title="Voting Window"
          startLabel="Voting start"
          endLabel="Voting end"
          window={form.votingWindow}
          errors={errors}
          onChange={(field, val) => updateWindow("votingWindow", field, val)}
        />

        <Box
          sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}
        >
          <FormControl
            component="fieldset"
            error={!!errors["moderationMode"]}
            data-testid="moderation-mode"
          >
            <FormLabel component="legend" sx={{ fontWeight: 700, fontSize: 13, mb: 1 }}>
              Moderation mode
            </FormLabel>
            <RadioGroup
              aria-label="Moderation mode"
              value={form.moderationMode}
              onChange={(e) => updateField("moderationMode", e.target.value)}
            >
              {MODERATION_MODES.map((m) => (
                <FormControlLabel
                  key={m.value}
                  value={m.value}
                  control={<Radio sx={{ "&.Mui-checked": { color: ACCENT } }} />}
                  label={m.label}
                  data-testid={`moderation-mode-${m.value}`}
                />
              ))}
            </RadioGroup>
            {errors["moderationMode"] && (
              <Typography variant="caption" color="error">
                {errors["moderationMode"]}
              </Typography>
            )}

            {/* Allow self-voting — organizer opt-in. Default OFF preserves contest
                integrity (attendees can't vote for their own photo). */}
            <FormControlLabel
              sx={{ mt: 1.5 }}
              control={
                <Checkbox
                  checked={!!form.allowSelfVote}
                  onChange={(e) => updateField("allowSelfVote", e.target.checked)}
                  sx={{ "&.Mui-checked": { color: ACCENT } }}
                  data-testid="allow-self-vote"
                />
              }
              label="Allow attendees to vote for their own submission"
            />
          </FormControl>
        </Box>
      </Box>
    </LocalizationProvider>
  );

  const allowedFileTypes = form.allowedMediaConstraints.allowedFileTypes;
  const maxFileSize = form.allowedMediaConstraints.maxFileSize;
  const maxFileSizeMb =
    maxFileSize === "" || maxFileSize === null || maxFileSize === undefined
      ? null
      : (Number(maxFileSize) / BYTES_PER_MB).toFixed(2);

  const renderLimitsStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Limits & Media
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Cap how many photos each attendee may submit and how many votes each may cast, constrain the
        accepted image types and size, and set how many winners the contest awards.
      </Typography>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
        <TextField
          size="small"
          type="number"
          label="Submissions per attendee"
          value={form.submissionsPerAttendeeLimit ?? ""}
          onChange={(e) => updateNumberField("submissionsPerAttendeeLimit", e.target.value)}
          error={!!errors["submissionsPerAttendeeLimit"]}
          helperText={
            errors["submissionsPerAttendeeLimit"] ||
            `${LIMITS.MIN_SUBMISSIONS_PER_ATTENDEE}–${LIMITS.MAX_SUBMISSIONS_PER_ATTENDEE}`
          }
          inputProps={{
            min: LIMITS.MIN_SUBMISSIONS_PER_ATTENDEE,
            max: LIMITS.MAX_SUBMISSIONS_PER_ATTENDEE,
            "aria-label": "Submissions per attendee",
            "data-testid": "submissions-per-attendee-input",
          }}
          sx={{ width: 220 }}
        />

        <TextField
          size="small"
          type="number"
          label="Votes per attendee"
          value={form.votesPerAttendeeLimit ?? ""}
          onChange={(e) => updateNumberField("votesPerAttendeeLimit", e.target.value)}
          error={!!errors["votesPerAttendeeLimit"]}
          helperText={
            errors["votesPerAttendeeLimit"] ||
            `${LIMITS.MIN_VOTES_PER_ATTENDEE}–${LIMITS.MAX_VOTES_PER_ATTENDEE.toLocaleString()}`
          }
          inputProps={{
            min: LIMITS.MIN_VOTES_PER_ATTENDEE,
            max: LIMITS.MAX_VOTES_PER_ATTENDEE,
            "aria-label": "Votes per attendee",
            "data-testid": "votes-per-attendee-input",
          }}
          sx={{ width: 220 }}
        />

        <TextField
          size="small"
          type="number"
          label="Winner count"
          value={form.winnerCount ?? ""}
          onChange={(e) => updateNumberField("winnerCount", e.target.value)}
          error={!!errors["winnerCount"]}
          helperText={errors["winnerCount"] || `${LIMITS.MIN_WINNERS}–${LIMITS.MAX_WINNERS}`}
          inputProps={{
            min: LIMITS.MIN_WINNERS,
            max: LIMITS.MAX_WINNERS,
            "aria-label": "Winner count",
            "data-testid": "winner-count-input",
          }}
          sx={{ width: 220 }}
        />
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "flex-start" }}>
        <FormControl
          size="small"
          sx={{ minWidth: 280 }}
          error={!!errors["allowedMediaConstraints.allowedFileTypes"]}
        >
          <InputLabel id="allowed-file-types-label">Allowed file types</InputLabel>
          <Select
            labelId="allowed-file-types-label"
            multiple
            value={allowedFileTypes}
            onChange={(e) => {
              const val = e.target.value;
              updateMedia("allowedFileTypes", typeof val === "string" ? val.split(",") : val);
            }}
            input={<OutlinedInput label="Allowed file types" />}
            renderValue={(selected) => selected.join(", ")}
            inputProps={{ "aria-label": "Allowed file types", "data-testid": "allowed-file-types-input" }}
          >
            {ALLOWED_FILE_TYPE_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                <Checkbox checked={allowedFileTypes.indexOf(opt.value) > -1} />
                <ListItemText primary={opt.label} />
              </MenuItem>
            ))}
          </Select>
          <Typography
            variant="caption"
            sx={{ mt: 0.5, ml: 1.5 }}
            color={errors["allowedMediaConstraints.allowedFileTypes"] ? "error" : "textSecondary"}
          >
            {errors["allowedMediaConstraints.allowedFileTypes"] ||
              "Choose one or more permitted image types."}
          </Typography>
        </FormControl>

        <TextField
          size="small"
          type="number"
          label="Max file size (bytes)"
          value={maxFileSize ?? ""}
          onChange={(e) => updateMedia("maxFileSize", e.target.value === "" ? "" : parseInt(e.target.value, 10))}
          error={!!errors["allowedMediaConstraints.maxFileSize"]}
          helperText={
            errors["allowedMediaConstraints.maxFileSize"] ||
            (maxFileSizeMb !== null
              ? `${LIMITS.MIN_FILE_SIZE}–${LIMITS.MAX_FILE_SIZE.toLocaleString()} bytes (≈ ${maxFileSizeMb} MB)`
              : `${LIMITS.MIN_FILE_SIZE}–${LIMITS.MAX_FILE_SIZE.toLocaleString()} bytes`)
          }
          inputProps={{
            min: LIMITS.MIN_FILE_SIZE,
            max: LIMITS.MAX_FILE_SIZE,
            "aria-label": "Max file size (bytes)",
            "data-testid": "max-file-size-input",
          }}
          sx={{ width: 280 }}
        />
      </Box>
    </Box>
  );

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Review & Save
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Review your photo contest configuration, then save it to this experience.
      </Typography>

      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#F8F9FA" }}>
        <Typography sx={{ fontSize: 13, color: "#374151", mb: 0.5 }}>
          Submission window:{" "}
          {form.submissionWindow.start?.format?.("MMM D, YYYY h:mm A") || "—"} →{" "}
          {form.submissionWindow.end?.format?.("MMM D, YYYY h:mm A") || "—"}
        </Typography>
        <Typography sx={{ fontSize: 13, color: "#374151", mb: 0.5 }}>
          Voting window: {form.votingWindow.start?.format?.("MMM D, YYYY h:mm A") || "—"} →{" "}
          {form.votingWindow.end?.format?.("MMM D, YYYY h:mm A") || "—"}
        </Typography>
        <Typography sx={{ fontSize: 13, color: "#374151", mb: 0.5 }}>
          Moderation: {form.moderationMode}
        </Typography>
        <Typography sx={{ fontSize: 13, color: "#374151", mb: 0.5 }}>
          Limits: {form.submissionsPerAttendeeLimit} submission(s) ·{" "}
          {form.votesPerAttendeeLimit} vote(s) per attendee · {form.winnerCount} winner(s)
        </Typography>
        <Typography sx={{ fontSize: 13, color: "#374151" }}>
          Media: {allowedFileTypes.join(", ") || "—"} · up to{" "}
          {Number(maxFileSize || 0).toLocaleString()} bytes
        </Typography>
      </Box>

    </Box>
  );

  const renderStep = () => {
    if (activeStep === 0) return renderWindowsStep();
    if (activeStep === 1) return renderLimitsStep();
    return renderReviewStep();
  };

  return (
    <EngagementConfigShell
      title="Configure Photo Contest"
      subtitle="Run a photo submission contest with community voting and prize awards."
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

export default PhotoContestConfig;
