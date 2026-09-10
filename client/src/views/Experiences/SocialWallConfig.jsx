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
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Switch,
  IconButton,
} from "@mui/material";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs from "dayjs";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { getInstance, updateInstance } from "../../services/experienceService";
import ThemeColorPicker from "./ThemeColorPicker";
import EngagementConfigShell from "./EngagementConfigShell";

const ACCENT = "#EC4899"; // Social & Community brand color (CATEGORY_COLORS)
const DEFAULT_ACCENT = "#EC4899"; // default theme color saved when none chosen

// Config limits — mirror the plugin's validateConfig rules (Requirements 1.2–1.10).
const LIMITS = {
  MIN_POST_RATE_LIMIT: 1,
  MAX_POST_RATE_LIMIT: 60,
  MIN_TEXT_LENGTH_LIMIT: 1,
  MAX_TEXT_LENGTH_LIMIT: 1000,
  MIN_FILE_SIZE: 1,
  MAX_FILE_SIZE: 26214400, // 25 MiB, in bytes
};

// The permitted image MIME types (Requirement 1.8).
const ALLOWED_FILE_TYPE_OPTIONS = [
  { value: "image/jpeg", label: "JPEG (image/jpeg)" },
  { value: "image/png", label: "PNG (image/png)" },
  { value: "image/webp", label: "WebP (image/webp)" },
  { value: "image/heic", label: "HEIC (image/heic)" },
];
const ALLOWED_FILE_TYPE_SET = new Set(ALLOWED_FILE_TYPE_OPTIONS.map((o) => o.value));

// Moderation modes (Requirement 12.3 / 1.3). Default mirrors the plugin (1.11).
const MODERATION_MODES = [
  { value: "auto_approve", label: "Auto-approve — posts appear immediately" },
  {
    value: "pre_moderation",
    label: "Pre-moderation (approve before display)",
  },
  {
    value: "post_moderation",
    label: "Post-moderation (visible immediately, removable)",
  },
];
const MODERATION_MODE_SET = new Set(MODERATION_MODES.map((m) => m.value));
const DEFAULT_MODERATION_MODE = "pre_moderation";

// Feed sort modes (Requirement 1.4). Default mirrors the plugin (1.12).
const FEED_SORT_MODES = [
  { value: "chronological", label: "Chronological — newest posts first" },
  { value: "top", label: "Top — most-reacted posts first" },
];
const FEED_SORT_MODE_SET = new Set(FEED_SORT_MODES.map((m) => m.value));
const DEFAULT_FEED_SORT_MODE = "chronological";

const STEPS = ["Window & Moderation", "Content Rules & Media", "Review & Save"];

const BYTES_PER_MB = 1048576;

const DEFAULT_FORM = {
  accentColor: DEFAULT_ACCENT,
  postWindow: { start: null, end: null },
  moderationMode: DEFAULT_MODERATION_MODE,
  keywordFilter: { keywords: [] },
  allowPhotos: true,
  postRateLimit: 10,
  textLengthLimit: 280,
  allowedMediaConstraints: {
    allowedFileTypes: ["image/jpeg", "image/png", "image/webp"],
    maxFileSize: 10485760, // 10 MiB default
  },
  feedSortMode: DEFAULT_FEED_SORT_MODE,
};

/**
 * Validates the social-wall configuration form, reproducing the backend
 * plugin rules (Requirements 1.2–1.10) into an errors map keyed by dotted field
 * path (e.g. `postWindow.start`, `allowedMediaConstraints.allowedFileTypes`) so
 * each control can surface its own error. Returns an object of
 * { fieldPath: message }. The plugin's validateConfig remains the server-side
 * authority.
 */
export function validateAll(form) {
  const errors = {};
  const isInt = (n) => Number.isInteger(n);

  // Dayjs objects expose valueOf(); guard for null/absent values.
  const ms = (d) => (d && typeof d.valueOf === "function" ? d.valueOf() : null);
  const startMs = ms(form?.postWindow?.start);
  const endMs = ms(form?.postWindow?.end);

  // ── Post window (Rule 1.2): start strictly before end ────────────────────────
  if (startMs === null) {
    errors["postWindow.start"] = "Post window start is required.";
  }
  if (endMs === null) {
    errors["postWindow.end"] = "Post window end is required.";
  }
  if (startMs !== null && endMs !== null && startMs >= endMs) {
    errors["postWindow.end"] = "Post window end must be after its start.";
  }

  // ── Moderation mode membership (Rule 1.3) ────────────────────────────────────
  if (!MODERATION_MODE_SET.has(form?.moderationMode)) {
    errors["moderationMode"] = "Select a valid moderation mode.";
  }

  // ── Feed sort mode membership (Rule 1.4) ─────────────────────────────────────
  if (!FEED_SORT_MODE_SET.has(form?.feedSortMode)) {
    errors["feedSortMode"] = "Select a valid feed sort mode.";
  }

  // ── Post rate limit (Rule 1.5): integer 1–60 ─────────────────────────────────
  const postRateLimit = Number(form?.postRateLimit);
  if (
    !isInt(postRateLimit) ||
    postRateLimit < LIMITS.MIN_POST_RATE_LIMIT ||
    postRateLimit > LIMITS.MAX_POST_RATE_LIMIT
  ) {
    errors["postRateLimit"] =
      `Post rate limit must be an integer between ${LIMITS.MIN_POST_RATE_LIMIT} and ${LIMITS.MAX_POST_RATE_LIMIT}.`;
  }

  // ── Text length limit (Rule 1.6): integer 1–1000 ─────────────────────────────
  const textLengthLimit = Number(form?.textLengthLimit);
  if (
    !isInt(textLengthLimit) ||
    textLengthLimit < LIMITS.MIN_TEXT_LENGTH_LIMIT ||
    textLengthLimit > LIMITS.MAX_TEXT_LENGTH_LIMIT
  ) {
    errors["textLengthLimit"] =
      `Text length limit must be an integer between ${LIMITS.MIN_TEXT_LENGTH_LIMIT} and ${LIMITS.MAX_TEXT_LENGTH_LIMIT.toLocaleString()}.`;
  }

  // ── Allow-photos flag (Rule 1.7): boolean ────────────────────────────────────
  if (typeof form?.allowPhotos !== "boolean") {
    errors["allowPhotos"] = "Allow-photos must be on or off.";
  }

  // ── Allowed media constraints (Rules 1.8, 1.9) — only WHEN allowPhotos true. ──
  if (form?.allowPhotos === true) {
    const allowedFileTypes = form?.allowedMediaConstraints?.allowedFileTypes || [];
    if (!Array.isArray(allowedFileTypes) || allowedFileTypes.length < 1) {
      errors["allowedMediaConstraints.allowedFileTypes"] =
        "Select at least one allowed image type.";
    } else if (!allowedFileTypes.every((t) => ALLOWED_FILE_TYPE_SET.has(t))) {
      errors["allowedMediaConstraints.allowedFileTypes"] =
        "Allowed types must be drawn from JPEG, PNG, WebP, and HEIC.";
    }

    const maxFileSize = Number(form?.allowedMediaConstraints?.maxFileSize);
    if (
      !isInt(maxFileSize) ||
      maxFileSize < LIMITS.MIN_FILE_SIZE ||
      maxFileSize > LIMITS.MAX_FILE_SIZE
    ) {
      errors["allowedMediaConstraints.maxFileSize"] =
        `Max file size must be an integer between ${LIMITS.MIN_FILE_SIZE} and ${LIMITS.MAX_FILE_SIZE.toLocaleString()} bytes.`;
    }
  }

  // ── Keyword filter (Rule 1.10) — validated only WHEN keywords are provided. ──
  // An empty list (filter disabled) is fine; each present term must be non-empty.
  const keywords = form?.keywordFilter?.keywords;
  if (Array.isArray(keywords) && keywords.length > 0) {
    const hasEmptyTerm = keywords.some(
      (k) => typeof k !== "string" || k.trim().length === 0
    );
    if (hasEmptyTerm) {
      errors["keywordFilter.keywords"] = "Keyword terms must be non-empty text.";
    }
  }

  return errors;
}

/**
 * KeywordRow — isolated editor for a single keyword entry (text field + remove
 * button). Wrapped in React.memo (like PhotoContestConfig's WindowFields) so
 * editing one keyword does not re-render its siblings and each input keeps focus
 * while typing (Requirement 10.2 parity).
 */
const KeywordRow = memo(({ index, value, error, onChange, onRemove }) => (
  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
    <TextField
      size="small"
      label={`Keyword ${index + 1}`}
      value={value}
      onChange={(e) => onChange(index, e.target.value)}
      error={!!error}
      helperText={error || " "}
      inputProps={{
        "aria-label": `Keyword ${index + 1}`,
        "data-testid": `keyword-input-${index}`,
      }}
      sx={{ flex: 1, minWidth: 220 }}
    />
    <IconButton
      aria-label={`Remove keyword ${index + 1}`}
      data-testid={`keyword-remove-${index}`}
      onClick={() => onRemove(index)}
      sx={{ mt: 0.5, color: "#6B7280" }}
    >
      <DeleteOutlineIcon fontSize="small" />
    </IconButton>
  </Box>
));

KeywordRow.displayName = "KeywordRow";

/**
 * SocialWallConfig — organizer-facing configuration screen for a Social Wall
 * experience instance. Mirrors PhotoContestConfig's stepped MUI form: memoized
 * editors that preserve input focus, an errors map keyed by field path,
 * client-side validation reproducing the plugin rules (1.2–1.10), and a save
 * that persists the config via updateInstance. The saved config shapes the post
 * window's start/end as ISO strings to match the plugin's SocialWall_Config.
 */
const SocialWallConfig = () => {
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
        if (!cancelled && cfg && (cfg.postWindow || cfg.moderationMode || cfg.feedSortMode)) {
          setForm({
            accentColor: cfg.accentColor || DEFAULT_ACCENT,
            postWindow: {
              start: cfg.postWindow?.start ? dayjs(cfg.postWindow.start) : null,
              end: cfg.postWindow?.end ? dayjs(cfg.postWindow.end) : null,
            },
            moderationMode: MODERATION_MODE_SET.has(cfg.moderationMode)
              ? cfg.moderationMode
              : DEFAULT_MODERATION_MODE,
            keywordFilter: {
              keywords: Array.isArray(cfg.keywordFilter?.keywords)
                ? [...cfg.keywordFilter.keywords]
                : [],
            },
            allowPhotos: typeof cfg.allowPhotos === "boolean" ? cfg.allowPhotos : true,
            postRateLimit: cfg.postRateLimit ?? 10,
            textLengthLimit: cfg.textLengthLimit ?? 280,
            allowedMediaConstraints: {
              allowedFileTypes: cfg.allowedMediaConstraints?.allowedFileTypes?.length
                ? cfg.allowedMediaConstraints.allowedFileTypes.filter((t) =>
                    ALLOWED_FILE_TYPE_SET.has(t)
                  )
                : ["image/jpeg", "image/png", "image/webp"],
              maxFileSize: cfg.allowedMediaConstraints?.maxFileSize ?? 10485760,
            },
            feedSortMode: FEED_SORT_MODE_SET.has(cfg.feedSortMode)
              ? cfg.feedSortMode
              : DEFAULT_FEED_SORT_MODE,
          });
        }
      } catch (err) {
        // Non-fatal: a brand-new instance has no config yet.
        console.log("SocialWallConfig: no existing config", err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, experienceId]);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const updateWindow = (field, value) => {
    setForm((prev) => ({
      ...prev,
      postWindow: { ...prev.postWindow, [field]: value },
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

  const updateKeyword = (index, value) => {
    setForm((prev) => {
      const keywords = [...prev.keywordFilter.keywords];
      keywords[index] = value;
      return { ...prev, keywordFilter: { ...prev.keywordFilter, keywords } };
    });
    setSaved(false);
  };

  const addKeyword = () => {
    setForm((prev) => ({
      ...prev,
      keywordFilter: { ...prev.keywordFilter, keywords: [...prev.keywordFilter.keywords, ""] },
    }));
    setSaved(false);
  };

  const removeKeyword = (index) => {
    setForm((prev) => {
      const keywords = prev.keywordFilter.keywords.filter((_, i) => i !== index);
      return { ...prev, keywordFilter: { ...prev.keywordFilter, keywords } };
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
        postWindow: {
          start: form.postWindow.start.toISOString(),
          end: form.postWindow.end.toISOString(),
        },
        moderationMode: form.moderationMode,
        keywordFilter: { keywords: [...form.keywordFilter.keywords] },
        allowPhotos: form.allowPhotos,
        postRateLimit: Number(form.postRateLimit),
        textLengthLimit: Number(form.textLengthLimit),
        feedSortMode: form.feedSortMode,
      };
      // Media constraints are persisted only when photos are allowed (Req 12.4).
      if (form.allowPhotos === true) {
        config.allowedMediaConstraints = {
          allowedFileTypes: [...form.allowedMediaConstraints.allowedFileTypes],
          maxFileSize: Number(form.allowedMediaConstraints.maxFileSize),
        };
      }
      await updateInstance(eventId, experienceId, { config });
      setSaved(true);
      // Return to the engagements dashboard after a successful save (matches Raffle).
      navigate(`/admin/my-events/${eventId}/experiences`);
    } catch (err) {
      setSaveError(
        err.response?.data?.message || err.message || "Failed to save social wall configuration."
      );
    } finally {
      setSaving(false);
    }
  };

  const renderWindowStep = () => (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <Box>
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          Window & Moderation
        </Typography>
        <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
          Set when attendees may post to the wall, and choose how posts are moderated before
          appearing in the feed.
        </Typography>

        <ThemeColorPicker
          value={form.accentColor}
          onChange={(hex) => {
            setForm((prev) => ({ ...prev, accentColor: hex }));
            setSaved(false);
          }}
          helper="Accent color used across this social wall's display"
        />

        <Box
          data-testid="window-editor-postWindow"
          sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13, mb: 1.5 }}>
            Post Window
          </Typography>
          <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
            <DateTimePicker
              label="Post window start"
              value={form.postWindow.start || null}
              onChange={(val) => updateWindow("start", val)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors["postWindow.start"],
                  helperText: errors["postWindow.start"] || " ",
                  inputProps: { "aria-label": "Post window start" },
                  "data-testid": "postWindow-start",
                  sx: { flex: 1, minWidth: 220 },
                },
              }}
            />
            <DateTimePicker
              label="Post window end"
              value={form.postWindow.end || null}
              onChange={(val) => updateWindow("end", val)}
              slotProps={{
                textField: {
                  fullWidth: true,
                  error: !!errors["postWindow.end"],
                  helperText: errors["postWindow.end"] || " ",
                  inputProps: { "aria-label": "Post window end" },
                  "data-testid": "postWindow-end",
                  sx: { flex: 1, minWidth: 220 },
                },
              }}
            />
          </Box>
        </Box>

        <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}>
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

  const renderContentStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Content Rules & Media
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Cap how often attendees may post and how long posts can be, filter unwanted keywords, and
        decide whether photos are allowed and how the feed is ordered.
      </Typography>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
        <TextField
          size="small"
          type="number"
          label="Post rate limit"
          value={form.postRateLimit ?? ""}
          onChange={(e) => updateNumberField("postRateLimit", e.target.value)}
          error={!!errors["postRateLimit"]}
          helperText={
            errors["postRateLimit"] ||
            `${LIMITS.MIN_POST_RATE_LIMIT}–${LIMITS.MAX_POST_RATE_LIMIT} posts / 60s`
          }
          inputProps={{
            min: LIMITS.MIN_POST_RATE_LIMIT,
            max: LIMITS.MAX_POST_RATE_LIMIT,
            "aria-label": "Post rate limit",
            "data-testid": "post-rate-limit-input",
          }}
          sx={{ width: 220 }}
        />

        <TextField
          size="small"
          type="number"
          label="Text length limit"
          value={form.textLengthLimit ?? ""}
          onChange={(e) => updateNumberField("textLengthLimit", e.target.value)}
          error={!!errors["textLengthLimit"]}
          helperText={
            errors["textLengthLimit"] ||
            `${LIMITS.MIN_TEXT_LENGTH_LIMIT}–${LIMITS.MAX_TEXT_LENGTH_LIMIT.toLocaleString()} characters`
          }
          inputProps={{
            min: LIMITS.MIN_TEXT_LENGTH_LIMIT,
            max: LIMITS.MAX_TEXT_LENGTH_LIMIT,
            "aria-label": "Text length limit",
            "data-testid": "text-length-limit-input",
          }}
          sx={{ width: 220 }}
        />

        <FormControl size="small" sx={{ minWidth: 220 }} error={!!errors["feedSortMode"]}>
          <InputLabel id="feed-sort-mode-label">Feed sort mode</InputLabel>
          <Select
            labelId="feed-sort-mode-label"
            label="Feed sort mode"
            value={form.feedSortMode}
            onChange={(e) => updateField("feedSortMode", e.target.value)}
            inputProps={{ "aria-label": "Feed sort mode", "data-testid": "feed-sort-mode-input" }}
          >
            {FEED_SORT_MODES.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </Select>
          {errors["feedSortMode"] && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
              {errors["feedSortMode"]}
            </Typography>
          )}
        </FormControl>
      </Box>

      {/* Keyword filter — add/remove rows, each in a memoized KeywordRow. */}
      <Box
        data-testid="keyword-filter"
        sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13, mb: 1.5 }}>
          Keyword filter
        </Typography>
        {form.keywordFilter.keywords.length === 0 && (
          <Typography sx={{ fontSize: 12, color: "#9CA3AF", mb: 1 }}>
            No keywords. Add terms to filter matching posts.
          </Typography>
        )}
        {form.keywordFilter.keywords.map((kw, i) => (
          <KeywordRow
            // Row identity is positional; keywords have no stable id.
            key={`keyword-${i}`}
            index={i}
            value={kw}
            error={errors["keywordFilter.keywords"] && (typeof kw !== "string" || kw.trim().length === 0)
              ? errors["keywordFilter.keywords"]
              : ""}
            onChange={updateKeyword}
            onRemove={removeKeyword}
          />
        ))}
        <Button
          startIcon={<AddIcon />}
          onClick={addKeyword}
          data-testid="add-keyword-button"
          sx={{ textTransform: "none", color: ACCENT, fontWeight: 700 }}
        >
          Add keyword
        </Button>
      </Box>

      {/* Photos toggle + media constraints (hidden/disabled when photos off, Req 12.4). */}
      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}>
        <FormControlLabel
          control={
            <Switch
              checked={form.allowPhotos}
              onChange={(e) => updateField("allowPhotos", e.target.checked)}
              inputProps={{ "aria-label": "Allow photos", "data-testid": "allow-photos-switch" }}
              sx={{ "& .Mui-checked": { color: ACCENT } }}
            />
          }
          label="Allow photo posts"
        />

        {form.allowPhotos && (
          <Box
            data-testid="media-constraints"
            sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "flex-start", mt: 1.5 }}
          >
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
                inputProps={{
                  "aria-label": "Allowed file types",
                  "data-testid": "allowed-file-types-input",
                }}
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
                color={
                  errors["allowedMediaConstraints.allowedFileTypes"] ? "error" : "textSecondary"
                }
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
              onChange={(e) =>
                updateMedia("maxFileSize", e.target.value === "" ? "" : parseInt(e.target.value, 10))
              }
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
        )}
      </Box>
    </Box>
  );

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Review & Save
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Review your social wall configuration, then save it to this experience.
      </Typography>

      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#F8F9FA" }}>
        <Typography sx={{ fontSize: 13, color: "#374151", mb: 0.5 }}>
          Post window: {form.postWindow.start?.format?.("MMM D, YYYY h:mm A") || "—"} →{" "}
          {form.postWindow.end?.format?.("MMM D, YYYY h:mm A") || "—"}
        </Typography>
        <Typography sx={{ fontSize: 13, color: "#374151", mb: 0.5 }}>
          Moderation: {form.moderationMode}
        </Typography>
        <Typography sx={{ fontSize: 13, color: "#374151", mb: 0.5 }}>
          Feed sort: {form.feedSortMode}
        </Typography>
        <Typography sx={{ fontSize: 13, color: "#374151", mb: 0.5 }}>
          Limits: up to {form.postRateLimit} post(s) / 60s · {form.textLengthLimit} char(s) per post
        </Typography>
        <Typography sx={{ fontSize: 13, color: "#374151", mb: 0.5 }}>
          Keywords: {form.keywordFilter.keywords.filter((k) => k && k.trim()).join(", ") || "none"}
        </Typography>
        <Typography sx={{ fontSize: 13, color: "#374151" }}>
          Photos:{" "}
          {form.allowPhotos
            ? `allowed · ${allowedFileTypes.join(", ") || "—"} · up to ${Number(
                maxFileSize || 0
              ).toLocaleString()} bytes`
            : "not allowed"}
        </Typography>
      </Box>

    </Box>
  );

  const renderStep = () => {
    if (activeStep === 0) return renderWindowStep();
    if (activeStep === 1) return renderContentStep();
    return renderReviewStep();
  };

  return (
    <EngagementConfigShell
      title="Configure Social Wall"
      subtitle="Let attendees post to a shared, moderated feed with reactions and optional photos."
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

export default SocialWallConfig;
