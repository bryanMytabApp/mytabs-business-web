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
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { getInstance, updateInstance } from "../../services/experienceService";
import ThemeColorPicker from "./ThemeColorPicker";
import EngagementConfigShell from "./EngagementConfigShell";

const ACCENT = "#3B82F6"; // Feedback & Surveys brand color
const DEFAULT_ACCENT = "#3B82F6"; // default theme color saved when none chosen

// Config limits — mirror the plugin's validateConfig rules (Requirement 1).
const LIMITS = {
  MAX_PROMPT: 200,
  MIN_MOOD_OPTIONS: 2,
  MAX_MOOD_OPTIONS: 7,
  MAX_LABEL: 50,
};

const REACTION_TYPES = ["mood", "thumbs", "rating"];

const STEPS = ["Prompt & Reaction Type", "Review & Save"];

let idCounter = 0;
const uid = (prefix) => `${prefix}-${Date.now()}-${idCounter++}`;

const makeMoodOption = (sentimentValue = 1) => ({
  id: uid("opt"),
  label: "",
  sentimentValue,
});

// Fixed option sets for the non-editable reaction types (Requirement 1.5/1.6).
// Rendered read-only in the form and seeded into form.options on selection so
// a save persists a valid config.
const FIXED_THUMBS_OPTIONS = [
  { id: "down", label: "Thumbs Down", sentimentValue: 0 },
  { id: "up", label: "Thumbs Up", sentimentValue: 1 },
];

const FIXED_RATING_OPTIONS = [
  { id: "r1", label: "1", sentimentValue: 1 },
  { id: "r2", label: "2", sentimentValue: 2 },
  { id: "r3", label: "3", sentimentValue: 3 },
  { id: "r4", label: "4", sentimentValue: 4 },
  { id: "r5", label: "5", sentimentValue: 5 },
];

// A sensible default mood set when the organizer first selects mood.
const defaultMoodOptions = () => [
  { ...makeMoodOption(1) },
  { ...makeMoodOption(2) },
];

// Return the option set that should back a given reaction type. For fixed
// types the set is cloned so React state is never sharing the module constant.
export function seedOptionsForType(reactionType, currentOptions) {
  if (reactionType === "thumbs") {
    return FIXED_THUMBS_OPTIONS.map((o) => ({ ...o }));
  }
  if (reactionType === "rating") {
    return FIXED_RATING_OPTIONS.map((o) => ({ ...o }));
  }
  // mood — keep existing editable options if they look like a mood set,
  // otherwise seed a default two-option set.
  const editable =
    Array.isArray(currentOptions) &&
    currentOptions.length >= LIMITS.MIN_MOOD_OPTIONS &&
    currentOptions.length <= LIMITS.MAX_MOOD_OPTIONS &&
    currentOptions.every((o) => o && typeof o === "object");
  return editable ? currentOptions.map((o) => ({ ...o })) : defaultMoodOptions();
}

const DEFAULT_FORM = {
  accentColor: DEFAULT_ACCENT,
  prompt: "",
  reactionType: "mood",
  options: defaultMoodOptions(),
  minSubmissionIntervalMs: 0,
};

/**
 * Validates the pulse configuration form, reproducing the backend plugin rules
 * (Requirement 1.2–1.7) into an errors map keyed by field path so each control
 * can surface its own error. Returns an object of { fieldPath: message }.
 */
export function validateAll(form) {
  const errors = {};

  // Rule 1.2 — prompt length 1..200.
  const prompt = form?.prompt ?? "";
  if (prompt.trim().length < 1) {
    errors["prompt"] = "Prompt is required.";
  } else if (prompt.length > LIMITS.MAX_PROMPT) {
    errors["prompt"] = `Prompt must be ${LIMITS.MAX_PROMPT} characters or fewer.`;
  }

  // Rule 1.3 — reaction type membership.
  const reactionType = form?.reactionType;
  if (!REACTION_TYPES.includes(reactionType)) {
    errors["reactionType"] = "Reaction type must be mood, thumbs, or rating.";
    return errors;
  }

  const options = form?.options || [];

  // Rule 1.7 — no two options may share an id (applies to every type).
  const idSeen = new Map();
  options.forEach((opt, idx) => {
    const id = opt?.id;
    if (id != null) {
      if (idSeen.has(id)) {
        errors[`options[${idx}].id`] = "Duplicate reaction option identifier.";
      } else {
        idSeen.set(id, idx);
      }
    }
  });

  if (reactionType === "mood") {
    // Rule 1.4 — 2..7 options, each unique id, label 1..50, integer sentimentValue.
    if (options.length < LIMITS.MIN_MOOD_OPTIONS) {
      errors["options"] = `At least ${LIMITS.MIN_MOOD_OPTIONS} options are required.`;
    } else if (options.length > LIMITS.MAX_MOOD_OPTIONS) {
      errors["options"] = `A maximum of ${LIMITS.MAX_MOOD_OPTIONS} options is allowed.`;
    }

    options.forEach((opt, idx) => {
      const label = opt?.label ?? "";
      if (label.trim().length < 1) {
        errors[`options[${idx}].label`] = "Option label is required.";
      } else if (label.length > LIMITS.MAX_LABEL) {
        errors[`options[${idx}].label`] = `Label must be ${LIMITS.MAX_LABEL} characters or fewer.`;
      }

      const sv = opt?.sentimentValue;
      if (sv === "" || sv === null || sv === undefined || !Number.isInteger(Number(sv))) {
        errors[`options[${idx}].sentimentValue`] = "Sentiment value must be an integer.";
      }
    });
  } else if (reactionType === "thumbs") {
    // Rule 1.5 — exactly 2 options with distinct sentiment values.
    if (options.length !== 2) {
      errors["options"] = "Thumbs requires exactly 2 options.";
    } else if (Number(options[0]?.sentimentValue) === Number(options[1]?.sentimentValue)) {
      errors["options"] = "Thumbs options must have distinct sentiment values.";
    }
  } else if (reactionType === "rating") {
    // Rule 1.6 — exactly 5 options spanning sentiment values 1..5.
    if (options.length !== 5) {
      errors["options"] = "Rating requires exactly 5 options.";
    } else {
      const values = options.map((o) => Number(o?.sentimentValue)).sort((a, b) => a - b);
      const spans = values.every((v, i) => v === i + 1);
      if (!spans) {
        errors["options"] = "Rating options must span sentiment values 1 through 5.";
      }
    }
  }

  return errors;
}

/**
 * MoodOptionEditor — isolated editor for a single mood reaction option. Wrapped
 * in React.memo (like LivePollConfig's PollEditor) so editing one option does
 * not re-render siblings and text fields keep focus across keystrokes.
 */
const MoodOptionEditor = memo(({ option, idx, errors, onUpdate, onDelete, canDelete }) => {
  const label = option.label ?? "";
  const sentimentValue = option.sentimentValue ?? "";

  return (
    <Box sx={{ display: "flex", gap: 1, mb: 1.5, alignItems: "flex-start" }}>
      <TextField
        fullWidth
        size="small"
        label={`Option ${idx + 1} label`}
        value={label}
        onChange={(e) => onUpdate({ ...option, label: e.target.value })}
        error={!!errors[`options[${idx}].label`]}
        helperText={errors[`options[${idx}].label`] || `${label.length}/${LIMITS.MAX_LABEL}`}
        inputProps={{ maxLength: LIMITS.MAX_LABEL + 1 }}
      />
      <TextField
        size="small"
        type="number"
        label="Sentiment"
        value={sentimentValue}
        onChange={(e) => {
          const raw = e.target.value;
          onUpdate({
            ...option,
            sentimentValue: raw === "" ? "" : parseInt(raw, 10),
          });
        }}
        error={!!errors[`options[${idx}].sentimentValue`]}
        helperText={errors[`options[${idx}].sentimentValue`] || "integer"}
        sx={{ width: 130 }}
      />
      <IconButton
        size="small"
        aria-label={`Remove option ${idx + 1}`}
        onClick={onDelete}
        disabled={!canDelete}
        sx={{ mt: 0.5 }}
      >
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
});

MoodOptionEditor.displayName = "MoodOptionEditor";

/**
 * PulseFeedbackConfig — organizer-facing configuration screen for a Pulse
 * Feedback experience instance. Mirrors LivePollConfig's stepped MUI form: an
 * errors map keyed by field path, a memoized option editor, client-side
 * validation reproducing the plugin rules, and a save that persists the config
 * via updateInstance.
 */
const PulseFeedbackConfig = () => {
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
    if (!eventId || !experienceId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getInstance(eventId, experienceId);
        const instance = res.data?.data || res.data;
        const cfg = instance?.config;
        if (!cancelled && cfg?.reactionType) {
          setForm({
            accentColor: cfg.accentColor || DEFAULT_ACCENT,
            prompt: cfg.prompt ?? "",
            reactionType: REACTION_TYPES.includes(cfg.reactionType) ? cfg.reactionType : "mood",
            options: (cfg.options?.length ? cfg.options : defaultMoodOptions()).map((o, oi) => ({
              id: o.id || `opt-${oi}`,
              label: o.label ?? "",
              sentimentValue: o.sentimentValue ?? oi + 1,
            })),
            minSubmissionIntervalMs: cfg.minSubmissionIntervalMs ?? 0,
          });
        }
      } catch (err) {
        // Non-fatal: a brand-new instance has no config yet.
        console.log("PulseFeedbackConfig: no existing config", err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, experienceId]);

  const changeReactionType = (reactionType) => {
    setForm((prev) => ({
      ...prev,
      reactionType,
      options: seedOptionsForType(reactionType, prev.options),
    }));
    setSaved(false);
  };

  const updateOption = (idx, updatedOption) => {
    setForm((prev) => ({
      ...prev,
      options: prev.options.map((o, i) => (i === idx ? updatedOption : o)),
    }));
    setSaved(false);
  };

  const addOption = () => {
    setForm((prev) =>
      prev.options.length >= LIMITS.MAX_MOOD_OPTIONS
        ? prev
        : { ...prev, options: [...prev.options, makeMoodOption(prev.options.length + 1)] }
    );
    setSaved(false);
  };

  const removeOption = (idx) => {
    setForm((prev) =>
      prev.options.length <= LIMITS.MIN_MOOD_OPTIONS
        ? prev
        : { ...prev, options: prev.options.filter((_, i) => i !== idx) }
    );
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
        prompt: form.prompt.trim(),
        reactionType: form.reactionType,
        options: form.options.map((o) => ({
          id: o.id,
          label: (o.label ?? "").toString().trim(),
          sentimentValue: Number(o.sentimentValue),
        })),
        minSubmissionIntervalMs: Number(form.minSubmissionIntervalMs) || 0,
      };
      await updateInstance(eventId, experienceId, { config });
      setSaved(true);
      // Return to the engagements dashboard after a successful save (matches Raffle).
      navigate(`/admin/my-events/${eventId}/experiences`);
    } catch (err) {
      setSaveError(
        err.response?.data?.message || err.message || "Failed to save pulse configuration."
      );
    } finally {
      setSaving(false);
    }
  };

  const isMood = form.reactionType === "mood";

  const renderPromptStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Prompt &amp; Reaction Type
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Write the pulse prompt attendees will react to, then choose how they react.
      </Typography>

      <ThemeColorPicker
        value={form.accentColor}
        onChange={(hex) => {
          setForm((prev) => ({ ...prev, accentColor: hex }));
          setSaved(false);
        }}
        helper="Accent color used across this pulse's display"
      />

      <TextField
        fullWidth
        size="small"
        label="Pulse Prompt"
        value={form.prompt}
        onChange={(e) => {
          const value = e.target.value;
          setForm((prev) => ({ ...prev, prompt: value }));
          setSaved(false);
        }}
        error={!!errors["prompt"]}
        helperText={errors["prompt"] || `${form.prompt.length}/${LIMITS.MAX_PROMPT}`}
        inputProps={{ maxLength: LIMITS.MAX_PROMPT + 1 }}
        sx={{ mb: 2 }}
      />

      <FormControl size="small" sx={{ minWidth: 220, mb: 2 }} error={!!errors["reactionType"]}>
        <InputLabel id="reaction-type-label">Reaction Type</InputLabel>
        <Select
          labelId="reaction-type-label"
          label="Reaction Type"
          value={form.reactionType}
          onChange={(e) => changeReactionType(e.target.value)}
        >
          <MenuItem value="mood">Mood</MenuItem>
          <MenuItem value="thumbs">Thumbs</MenuItem>
          <MenuItem value="rating">Rating (1–5)</MenuItem>
        </Select>
      </FormControl>

      {isMood ? (
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#374151", mb: 1 }}>
            Reaction Options ({form.options.length}/{LIMITS.MAX_MOOD_OPTIONS})
          </Typography>
          {errors["options"] && (
            <Typography variant="caption" color="error" sx={{ display: "block", mb: 1 }}>
              {errors["options"]}
            </Typography>
          )}

          {form.options.map((opt, idx) => (
            <MoodOptionEditor
              key={opt.id}
              option={opt}
              idx={idx}
              errors={errors}
              canDelete={form.options.length > LIMITS.MIN_MOOD_OPTIONS}
              onUpdate={(updated) => updateOption(idx, updated)}
              onDelete={() => removeOption(idx)}
            />
          ))}

          <Button
            startIcon={<AddIcon />}
            onClick={addOption}
            disabled={form.options.length >= LIMITS.MAX_MOOD_OPTIONS}
            sx={{ textTransform: "none", color: ACCENT }}
          >
            Add Option
          </Button>
        </Box>
      ) : (
        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#374151", mb: 1 }}>
            {form.reactionType === "thumbs" ? "Thumbs" : "Rating"} options (fixed)
          </Typography>
          <Box sx={{ p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#F8F9FA" }}>
            {form.options.map((opt, idx) => (
              <TextField
                key={opt.id}
                fullWidth
                size="small"
                label={`Option ${idx + 1}`}
                value={`${opt.label} (sentiment ${opt.sentimentValue})`}
                InputProps={{ readOnly: true }}
                inputProps={{ "data-testid": `fixed-option-${opt.id}` }}
                sx={{ mb: 1.5 }}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Review &amp; Save
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Confirm your pulse prompt, then save the configuration to this experience.
      </Typography>

      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#F8F9FA" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>
          {form.prompt || "Pulse prompt"}
        </Typography>
        <Typography sx={{ fontSize: 12, color: "#6B7280", mb: 1 }}>
          Reaction type: {form.reactionType}
        </Typography>
        {form.options.map((o, oi) => (
          <Typography key={o.id} sx={{ fontSize: 13, color: "#374151" }}>
            • {o.label || `Option ${oi + 1}`} (sentiment {o.sentimentValue})
          </Typography>
        ))}
      </Box>

    </Box>
  );

  return (
    <EngagementConfigShell
      title="Configure Pulse Feedback"
      subtitle="Capture quick sentiment reactions from attendees throughout your event."
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
      {activeStep === 0 ? renderPromptStep() : renderReviewStep()}
    </EngagementConfigShell>
  );
};

export default PulseFeedbackConfig;
