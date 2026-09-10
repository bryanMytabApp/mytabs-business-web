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
  FormControlLabel,
  Switch,
  Alert,
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { getInstance, updateInstance } from "../../services/experienceService";
import ThemeColorPicker from "./ThemeColorPicker";
import EngagementConfigShell from "./EngagementConfigShell";

const ACCENT = "#3B82F6"; // Feedback & Surveys brand color
const DEFAULT_ACCENT = "#3B82F6"; // default theme color saved when none chosen

// Config limits — mirror the plugin's validateConfig rules (Requirements 1 & 2).
const LIMITS = {
  MIN_QUESTIONS: 1,
  MAX_QUESTIONS: 50,
  MAX_TITLE: 150,
  MAX_PROMPT: 300,
  MIN_OPTIONS: 2,
  MAX_OPTIONS: 10,
  MAX_LABEL: 100,
  RATING_MAX_MIN: 2,
  RATING_MAX_MAX: 10,
};

const QUESTION_TYPES = ["single_choice", "multiple_choice", "rating", "free_text"];
const CHOICE_TYPES = ["single_choice", "multiple_choice"];

const TYPE_LABELS = {
  single_choice: "Single choice",
  multiple_choice: "Multiple choice",
  rating: "Rating",
  free_text: "Free text",
};

const STEPS = ["Survey Details", "Questions", "Availability", "Review & Save"];

let idCounter = 0;
const uid = (prefix) => `${prefix}-${Date.now()}-${idCounter++}`;

const makeOption = () => ({ id: uid("opt"), label: "" });

const makeQuestion = (type = "single_choice") => {
  const base = { id: uid("q"), prompt: "", type, required: false };
  if (CHOICE_TYPES.includes(type)) {
    return { ...base, options: [makeOption(), makeOption()] };
  }
  if (type === "rating") {
    return { ...base, ratingScale: { min: 1, max: 5 } };
  }
  return base;
};

const DEFAULT_FORM = {
  title: "",
  accentColor: DEFAULT_ACCENT,
  questions: [makeQuestion("single_choice")],
  availabilityWindow: { openTime: "", closeTime: "" },
};

// Seed type-appropriate defaults when a question's type changes. Choice types
// get two blank options; rating gets {min:1,max:5}; free_text clears both.
function seedForType(question, nextType) {
  const base = { id: question.id, prompt: question.prompt, type: nextType, required: question.required };
  if (CHOICE_TYPES.includes(nextType)) {
    const existing = Array.isArray(question.options) && question.options.length >= LIMITS.MIN_OPTIONS
      ? question.options.map((o) => ({ ...o }))
      : [makeOption(), makeOption()];
    return { ...base, options: existing };
  }
  if (nextType === "rating") {
    const scale = question.ratingScale && typeof question.ratingScale === "object"
      ? { min: question.ratingScale.min ?? 1, max: question.ratingScale.max ?? 5 }
      : { min: 1, max: 5 };
    return { ...base, ratingScale: scale };
  }
  // free_text — no extra settings.
  return base;
}

/**
 * Validates the survey configuration form, reproducing the backend plugin rules
 * (Requirements 1.2–1.9 and 2.1–2.2) into an errors map keyed by field path so
 * each control can surface its own error. Returns an object of
 * { fieldPath: message }. The plugin's validateConfig remains the server-side
 * authority.
 */
export function validateAll(form) {
  const errors = {};

  // Rule 1.2 — title length 1..150.
  const title = form?.title ?? "";
  if (title.trim().length < 1) {
    errors["title"] = "Survey title is required.";
  } else if (title.length > LIMITS.MAX_TITLE) {
    errors["title"] = `Title must be ${LIMITS.MAX_TITLE} characters or fewer.`;
  }

  // Rule 1.3 — question count 1..50.
  const questions = form?.questions || [];
  if (questions.length < LIMITS.MIN_QUESTIONS) {
    errors["questions"] = `At least ${LIMITS.MIN_QUESTIONS} question is required.`;
  } else if (questions.length > LIMITS.MAX_QUESTIONS) {
    errors["questions"] = `A maximum of ${LIMITS.MAX_QUESTIONS} questions is allowed.`;
  }

  questions.forEach((q, qIdx) => {
    // Rule 1.4 — prompt length 1..300.
    const prompt = q.prompt ?? "";
    if (prompt.trim().length < 1) {
      errors[`questions[${qIdx}].prompt`] = "Question prompt is required.";
    } else if (prompt.length > LIMITS.MAX_PROMPT) {
      errors[`questions[${qIdx}].prompt`] = `Prompt must be ${LIMITS.MAX_PROMPT} characters or fewer.`;
    }

    // Rule 1.5 — type membership.
    if (!QUESTION_TYPES.includes(q.type)) {
      errors[`questions[${qIdx}].type`] = "Invalid question type.";
    }

    // Rule 1.6 — required must be boolean (the Switch always yields a boolean,
    // but validate defensively for loaded configs).
    if (typeof q.required !== "boolean") {
      errors[`questions[${qIdx}].required`] = "Required flag must be true or false.";
    }

    if (CHOICE_TYPES.includes(q.type)) {
      // Rule 1.7 — option count 2..10, each label 1..100.
      const options = q.options || [];
      if (options.length < LIMITS.MIN_OPTIONS) {
        errors[`questions[${qIdx}].options`] = `At least ${LIMITS.MIN_OPTIONS} options are required.`;
      } else if (options.length > LIMITS.MAX_OPTIONS) {
        errors[`questions[${qIdx}].options`] = `A maximum of ${LIMITS.MAX_OPTIONS} options is allowed.`;
      }

      // Rule 1.9 — no duplicate labels within a choice question.
      const seen = new Map();
      options.forEach((opt, oIdx) => {
        const label = opt.label ?? "";
        if (label.trim().length < 1) {
          errors[`questions[${qIdx}].options[${oIdx}].label`] = "Option label is required.";
        } else if (label.length > LIMITS.MAX_LABEL) {
          errors[`questions[${qIdx}].options[${oIdx}].label`] = `Label must be ${LIMITS.MAX_LABEL} characters or fewer.`;
        } else {
          const key = label.trim().toLowerCase();
          if (seen.has(key)) {
            errors[`questions[${qIdx}].options[${oIdx}].label`] = "Duplicate option label.";
          } else {
            seen.set(key, oIdx);
          }
        }
      });
    } else if (q.type === "rating") {
      // Rule 1.8 — min ∈ {0,1}, max integer in [2,10], max > min.
      const min = Number(q.ratingScale?.min);
      const max = Number(q.ratingScale?.max);
      if (!Number.isInteger(min) || (min !== 0 && min !== 1)) {
        errors[`questions[${qIdx}].ratingScale.min`] = "Minimum must be 0 or 1.";
      }
      if (!Number.isInteger(max) || max < LIMITS.RATING_MAX_MIN || max > LIMITS.RATING_MAX_MAX) {
        errors[`questions[${qIdx}].ratingScale.max`] = `Maximum must be an integer between ${LIMITS.RATING_MAX_MIN} and ${LIMITS.RATING_MAX_MAX}.`;
      } else if (Number.isInteger(min) && max <= min) {
        errors[`questions[${qIdx}].ratingScale.max`] = "Maximum must be greater than minimum.";
      }
    }
  });

  // Rule 2.1 — open time is a valid timestamp.
  const openTime = form?.availabilityWindow?.openTime ?? "";
  const openMs = openTime ? Date.parse(openTime) : NaN;
  if (!openTime || Number.isNaN(openMs)) {
    errors["availabilityWindow.openTime"] = "A valid open time is required.";
  }

  // Rule 2.2 — close time, when present, is valid and strictly after open.
  const closeTime = form?.availabilityWindow?.closeTime ?? "";
  if (closeTime) {
    const closeMs = Date.parse(closeTime);
    if (Number.isNaN(closeMs)) {
      errors["availabilityWindow.closeTime"] = "Close time must be a valid timestamp.";
    } else if (!Number.isNaN(openMs) && closeMs <= openMs) {
      errors["availabilityWindow.closeTime"] = "Close time must be after the open time.";
    }
  }

  return errors;
}

/**
 * QuestionEditor — isolated editor for a single survey question. Wrapped in
 * React.memo (like LivePollConfig's PollEditor) so editing one question does
 * not re-render siblings and text fields keep focus across keystrokes.
 */
const QuestionEditor = memo(
  ({ question, idx, count, errors, onUpdate, onDelete, onMoveUp, onMoveDown }) => {
    const promptValue = question.prompt ?? "";
    const options = question.options || [];
    const isChoice = CHOICE_TYPES.includes(question.type);
    const isRating = question.type === "rating";

    const updateOption = (oIdx, label) => {
      const next = options.map((o, i) => (i === oIdx ? { ...o, label } : o));
      onUpdate({ ...question, options: next });
    };

    const addOption = () => {
      if (options.length >= LIMITS.MAX_OPTIONS) return;
      onUpdate({ ...question, options: [...options, makeOption()] });
    };

    const removeOption = (oIdx) => {
      if (options.length <= LIMITS.MIN_OPTIONS) return;
      onUpdate({ ...question, options: options.filter((_, i) => i !== oIdx) });
    };

    const changeType = (nextType) => {
      onUpdate(seedForType(question, nextType));
    };

    const updateScale = (key, raw) => {
      const value = raw === "" ? "" : parseInt(raw, 10);
      onUpdate({
        ...question,
        ratingScale: { ...(question.ratingScale || {}), [key]: value },
      });
    };

    return (
      <Box
        data-testid={`question-editor-${idx}`}
        sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
            Question {idx + 1}
          </Typography>
          <Box>
            <IconButton
              size="small"
              aria-label={`Move question ${idx + 1} up`}
              onClick={onMoveUp}
              disabled={idx === 0}
            >
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label={`Move question ${idx + 1} down`}
              onClick={onMoveDown}
              disabled={idx === count - 1}
            >
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label={`Remove question ${idx + 1}`}
              onClick={onDelete}
              disabled={count <= LIMITS.MIN_QUESTIONS}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <TextField
          fullWidth
          size="small"
          label="Prompt"
          value={promptValue}
          onChange={(e) => onUpdate({ ...question, prompt: e.target.value })}
          error={!!errors[`questions[${idx}].prompt`]}
          helperText={errors[`questions[${idx}].prompt`] || `${promptValue.length}/${LIMITS.MAX_PROMPT}`}
          inputProps={{ maxLength: LIMITS.MAX_PROMPT + 1 }}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap", alignItems: "center" }}>
          <FormControl size="small" sx={{ minWidth: 200 }} error={!!errors[`questions[${idx}].type`]}>
            <InputLabel id={`type-label-${idx}`}>Question Type</InputLabel>
            <Select
              labelId={`type-label-${idx}`}
              label="Question Type"
              value={question.type}
              onChange={(e) => changeType(e.target.value)}
            >
              {QUESTION_TYPES.map((t) => (
                <MenuItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Switch
                checked={!!question.required}
                onChange={(e) => onUpdate({ ...question, required: e.target.checked })}
                inputProps={{ "aria-label": `Required question ${idx + 1}` }}
              />
            }
            label="Required"
          />
        </Box>

        {isChoice && (
          <Box>
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#374151", mb: 1 }}>
              Answer Options ({options.length}/{LIMITS.MAX_OPTIONS})
            </Typography>
            {errors[`questions[${idx}].options`] && (
              <Typography variant="caption" color="error" sx={{ display: "block", mb: 1 }}>
                {errors[`questions[${idx}].options`]}
              </Typography>
            )}

            {options.map((opt, oIdx) => (
              <Box key={opt.id} sx={{ display: "flex", gap: 1, mb: 1.5, alignItems: "flex-start" }}>
                <TextField
                  fullWidth
                  size="small"
                  label={`Option ${oIdx + 1}`}
                  value={opt.label ?? ""}
                  onChange={(e) => updateOption(oIdx, e.target.value)}
                  error={!!errors[`questions[${idx}].options[${oIdx}].label`]}
                  helperText={
                    errors[`questions[${idx}].options[${oIdx}].label`] ||
                    `${(opt.label ?? "").length}/${LIMITS.MAX_LABEL}`
                  }
                  inputProps={{ maxLength: LIMITS.MAX_LABEL + 1 }}
                />
                <IconButton
                  size="small"
                  aria-label={`Remove option ${oIdx + 1} of question ${idx + 1}`}
                  onClick={() => removeOption(oIdx)}
                  disabled={options.length <= LIMITS.MIN_OPTIONS}
                  sx={{ mt: 0.5 }}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}

            <Button
              startIcon={<AddIcon />}
              onClick={addOption}
              disabled={options.length >= LIMITS.MAX_OPTIONS}
              sx={{ textTransform: "none", color: ACCENT }}
            >
              Add Option
            </Button>
          </Box>
        )}

        {isRating && (
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
            <TextField
              size="small"
              type="number"
              label="Min"
              value={question.ratingScale?.min ?? ""}
              onChange={(e) => updateScale("min", e.target.value)}
              error={!!errors[`questions[${idx}].ratingScale.min`]}
              helperText={errors[`questions[${idx}].ratingScale.min`] || "0 or 1"}
              inputProps={{ min: 0, max: 1 }}
              sx={{ width: 140 }}
            />
            <TextField
              size="small"
              type="number"
              label="Max"
              value={question.ratingScale?.max ?? ""}
              onChange={(e) => updateScale("max", e.target.value)}
              error={!!errors[`questions[${idx}].ratingScale.max`]}
              helperText={
                errors[`questions[${idx}].ratingScale.max`] ||
                `${LIMITS.RATING_MAX_MIN}–${LIMITS.RATING_MAX_MAX}`
              }
              inputProps={{ min: LIMITS.RATING_MAX_MIN, max: LIMITS.RATING_MAX_MAX }}
              sx={{ width: 140 }}
            />
          </Box>
        )}
      </Box>
    );
  }
);

QuestionEditor.displayName = "QuestionEditor";

/**
 * SurveyConfig — organizer-facing configuration screen for a Surveys experience
 * instance. Mirrors LivePollConfig/PulseFeedbackConfig's stepped MUI form: an
 * errors map keyed by field path, memoized question editors, client-side
 * validation reproducing the plugin rules, and a save that persists the config
 * via updateInstance.
 */
const SurveyConfig = () => {
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
        if (!cancelled && cfg?.questions?.length) {
          setForm({
            title: cfg.title ?? "",
            accentColor: cfg.accentColor || DEFAULT_ACCENT,
            questions: cfg.questions.map((q, qi) => {
              const type = QUESTION_TYPES.includes(q.type) ? q.type : "single_choice";
              const base = {
                id: q.id || uid("q"),
                prompt: q.prompt ?? "",
                type,
                required: typeof q.required === "boolean" ? q.required : false,
              };
              if (CHOICE_TYPES.includes(type)) {
                const opts = q.options?.length ? q.options : [makeOption(), makeOption()];
                return {
                  ...base,
                  options: opts.map((o, oi) => ({
                    id: o.id || `${q.id || qi}-opt-${oi}`,
                    label: o.label ?? "",
                  })),
                };
              }
              if (type === "rating") {
                return {
                  ...base,
                  ratingScale: {
                    min: q.ratingScale?.min ?? 1,
                    max: q.ratingScale?.max ?? 5,
                  },
                };
              }
              return base;
            }),
            availabilityWindow: {
              openTime: cfg.availabilityWindow?.openTime
                ? toLocalInput(cfg.availabilityWindow.openTime)
                : "",
              closeTime: cfg.availabilityWindow?.closeTime
                ? toLocalInput(cfg.availabilityWindow.closeTime)
                : "",
            },
          });
        }
      } catch (err) {
        // Non-fatal: a brand-new instance has no config yet.
        console.log("SurveyConfig: no existing config", err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, experienceId]);

  const updateQuestion = (idx, updatedQuestion) => {
    setForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === idx ? updatedQuestion : q)),
    }));
    setSaved(false);
  };

  const addQuestion = () => {
    setForm((prev) =>
      prev.questions.length >= LIMITS.MAX_QUESTIONS
        ? prev
        : { ...prev, questions: [...prev.questions, makeQuestion("single_choice")] }
    );
    setSaved(false);
  };

  const removeQuestion = (idx) => {
    setForm((prev) =>
      prev.questions.length <= LIMITS.MIN_QUESTIONS
        ? prev
        : { ...prev, questions: prev.questions.filter((_, i) => i !== idx) }
    );
    setSaved(false);
  };

  // Reorder by swapping the target question with its neighbor. Rewrites the
  // questions array so the config persists the new order (Requirement 7.8).
  const moveQuestion = (idx, delta) => {
    setForm((prev) => {
      const target = idx + delta;
      if (target < 0 || target >= prev.questions.length) return prev;
      const questions = [...prev.questions];
      [questions[idx], questions[target]] = [questions[target], questions[idx]];
      return { ...prev, questions };
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
        title: form.title.trim(),
        accentColor: form.accentColor || DEFAULT_ACCENT,
        questions: form.questions.map((q) => {
          const base = {
            id: q.id,
            prompt: q.prompt.trim(),
            type: q.type,
            required: !!q.required,
          };
          if (CHOICE_TYPES.includes(q.type)) {
            return {
              ...base,
              options: q.options.map((o) => ({ id: o.id, label: o.label.trim() })),
            };
          }
          if (q.type === "rating") {
            return {
              ...base,
              ratingScale: {
                min: Number(q.ratingScale.min),
                max: Number(q.ratingScale.max),
              },
            };
          }
          return base;
        }),
        availabilityWindow: {
          openTime: new Date(form.availabilityWindow.openTime).toISOString(),
          ...(form.availabilityWindow.closeTime
            ? { closeTime: new Date(form.availabilityWindow.closeTime).toISOString() }
            : {}),
        },
      };
      await updateInstance(eventId, experienceId, { config });
      setSaved(true);
      // Return to the engagements dashboard after a successful save (matches Raffle).
      navigate(`/admin/my-events/${eventId}/experiences`);
    } catch (err) {
      setSaveError(
        err.response?.data?.message || err.message || "Failed to save survey configuration."
      );
    } finally {
      setSaving(false);
    }
  };

  const renderDetailsStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Survey Details
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Give your survey a title attendees will see before they respond.
      </Typography>

      <TextField
        fullWidth
        size="small"
        label="Survey Title"
        value={form.title}
        onChange={(e) => {
          const value = e.target.value;
          setForm((prev) => ({ ...prev, title: value }));
          setSaved(false);
        }}
        error={!!errors["title"]}
        helperText={errors["title"] || `${form.title.length}/${LIMITS.MAX_TITLE}`}
        inputProps={{ maxLength: LIMITS.MAX_TITLE + 1 }}
        sx={{ mb: 2 }}
      />

      <ThemeColorPicker
        value={form.accentColor}
        onChange={(hex) => {
          setForm((prev) => ({ ...prev, accentColor: hex }));
          setSaved(false);
        }}
        helper="Accent color used across this survey's display"
      />
    </Box>
  );

  const renderQuestionsStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Questions ({form.questions.length}/{LIMITS.MAX_QUESTIONS})
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Add the questions attendees will answer. Choose a type per question and mark it required or optional.
      </Typography>

      {errors["questions"] && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {errors["questions"]}
        </Alert>
      )}

      {form.questions.map((question, idx) => (
        <QuestionEditor
          key={question.id}
          question={question}
          idx={idx}
          count={form.questions.length}
          errors={errors}
          onUpdate={(updated) => updateQuestion(idx, updated)}
          onDelete={() => removeQuestion(idx)}
          onMoveUp={() => moveQuestion(idx, -1)}
          onMoveDown={() => moveQuestion(idx, 1)}
        />
      ))}

      <Button
        startIcon={<AddIcon />}
        onClick={addQuestion}
        disabled={form.questions.length >= LIMITS.MAX_QUESTIONS}
        variant="outlined"
        sx={{ textTransform: "none", borderColor: ACCENT, color: ACCENT }}
      >
        Add Question
      </Button>
    </Box>
  );

  const renderAvailabilityStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Availability
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Choose when the survey opens. Leave the close time empty to keep it open for post-event feedback.
      </Typography>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "flex-start" }}>
        <TextField
          size="small"
          type="datetime-local"
          label="Open Time"
          InputLabelProps={{ shrink: true }}
          value={form.availabilityWindow.openTime}
          onChange={(e) => {
            const value = e.target.value;
            setForm((prev) => ({
              ...prev,
              availabilityWindow: { ...prev.availabilityWindow, openTime: value },
            }));
            setSaved(false);
          }}
          error={!!errors["availabilityWindow.openTime"]}
          helperText={errors["availabilityWindow.openTime"] || "Required"}
          sx={{ width: 260 }}
        />

        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
          <TextField
            size="small"
            type="datetime-local"
            label="Close Time (optional)"
            InputLabelProps={{ shrink: true }}
            value={form.availabilityWindow.closeTime}
            onChange={(e) => {
              const value = e.target.value;
              setForm((prev) => ({
                ...prev,
                availabilityWindow: { ...prev.availabilityWindow, closeTime: value },
              }));
              setSaved(false);
            }}
            error={!!errors["availabilityWindow.closeTime"]}
            helperText={errors["availabilityWindow.closeTime"] || "Leave empty to stay open"}
            sx={{ width: 260 }}
          />
          {form.availabilityWindow.closeTime && (
            <Button
              size="small"
              aria-label="Clear close time"
              onClick={() => {
                setForm((prev) => ({
                  ...prev,
                  availabilityWindow: { ...prev.availabilityWindow, closeTime: "" },
                }));
                setSaved(false);
              }}
              sx={{ textTransform: "none", color: "#6B7280", mt: 0.5 }}
            >
              Clear
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Review &amp; Save
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Confirm your survey, then save the configuration to this experience.
      </Typography>

      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#F8F9FA" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>
          {form.title || "Untitled survey"}
        </Typography>
        {form.questions.map((q, idx) => (
          <Box key={q.id} sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
              {idx + 1}. {q.prompt || `Question ${idx + 1}`}{" "}
              <Typography component="span" sx={{ fontSize: 12, color: "#6B7280" }}>
                ({TYPE_LABELS[q.type]}
                {q.required ? " · required" : " · optional"})
              </Typography>
            </Typography>
          </Box>
        ))}
      </Box>

    </Box>
  );

  const renderStep = () => {
    if (activeStep === 0) return renderDetailsStep();
    if (activeStep === 1) return renderQuestionsStep();
    if (activeStep === 2) return renderAvailabilityStep();
    return renderReviewStep();
  };

  return (
    <EngagementConfigShell
      title="Configure Surveys"
      subtitle="Author a multi-question survey and set when it accepts responses."
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

// Convert an ISO timestamp to the `YYYY-MM-DDTHH:mm` shape a datetime-local
// input expects, using the local timezone offset so the displayed time matches
// what the organizer originally picked.
function toLocalInput(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default SurveyConfig;
