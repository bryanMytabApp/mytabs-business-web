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
  Radio,
  RadioGroup,
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

const ACCENT = "#22C55E"; // Games & Challenges brand color
const DEFAULT_ACCENT = "#22C55E"; // default theme color saved when none chosen

// Config limits — mirror the plugin's validateConfig rules (Requirement 1).
const LIMITS = {
  MIN_QUESTIONS: 1,
  MAX_QUESTIONS: 50,
  MAX_PROMPT: 300,
  MIN_OPTIONS: 2,
  MAX_OPTIONS: 6,
  MAX_LABEL: 150,
  MIN_TIME_LIMIT: 5,
  MAX_TIME_LIMIT: 300,
  MIN_POINT_VALUE: 1,
  MAX_POINT_VALUE: 10000,
};

const SPEED_BONUS_VALUES = ["off", "on"];

const STEPS = ["Questions", "Scoring & Review"];

let idCounter = 0;
const uid = (prefix) => `${prefix}-${Date.now()}-${idCounter++}`;

const makeOption = () => ({ id: uid("opt"), label: "" });

const makeQuestion = () => {
  const options = [makeOption(), makeOption()];
  return {
    id: uid("q"),
    prompt: "",
    options,
    correctOptionId: options[0].id,
    timeLimit: 20,
    pointValue: 100,
  };
};

const DEFAULT_FORM = {
  accentColor: DEFAULT_ACCENT,
  speedBonus: "off",
  questions: [makeQuestion()],
};

/**
 * Validates the trivia configuration form, reproducing the backend plugin rules
 * (Requirements 1.2–1.9) into an errors map keyed by field path (e.g.
 * `questions[0].options[2].label`) so each control can surface its own error.
 * Returns an object of { fieldPath: message }. The plugin's validateConfig
 * remains the server-side authority.
 */
export function validateAll(form) {
  const errors = {};

  // Rule 1.8 — speedBonus ∈ {off, on}.
  if (!SPEED_BONUS_VALUES.includes(form?.speedBonus)) {
    errors["speedBonus"] = "Speed bonus must be off or on.";
  }

  // Rule 1.2 — question count 1..50.
  const questions = form?.questions || [];
  if (questions.length < LIMITS.MIN_QUESTIONS) {
    errors["questions"] = `At least ${LIMITS.MIN_QUESTIONS} question is required.`;
  } else if (questions.length > LIMITS.MAX_QUESTIONS) {
    errors["questions"] = `A maximum of ${LIMITS.MAX_QUESTIONS} questions is allowed.`;
  }

  questions.forEach((q, qIdx) => {
    // Rule 1.3 — prompt length 1..300.
    const prompt = q.prompt ?? "";
    if (prompt.trim().length < 1) {
      errors[`questions[${qIdx}].prompt`] = "Question prompt is required.";
    } else if (prompt.length > LIMITS.MAX_PROMPT) {
      errors[`questions[${qIdx}].prompt`] = `Prompt must be ${LIMITS.MAX_PROMPT} characters or fewer.`;
    }

    // Rule 1.4 — option count 2..6, unique ids, each label 1..150.
    const options = q.options || [];
    if (options.length < LIMITS.MIN_OPTIONS) {
      errors[`questions[${qIdx}].options`] = `At least ${LIMITS.MIN_OPTIONS} options are required.`;
    } else if (options.length > LIMITS.MAX_OPTIONS) {
      errors[`questions[${qIdx}].options`] = `A maximum of ${LIMITS.MAX_OPTIONS} options is allowed.`;
    }

    const seenIds = new Map();
    options.forEach((opt, oIdx) => {
      const label = opt.label ?? "";
      if (label.trim().length < 1) {
        errors[`questions[${qIdx}].options[${oIdx}].label`] = "Option label is required.";
      } else if (label.length > LIMITS.MAX_LABEL) {
        errors[`questions[${qIdx}].options[${oIdx}].label`] = `Label must be ${LIMITS.MAX_LABEL} characters or fewer.`;
      }
      // Rule 1.9 — duplicate option identifiers within a question.
      if (opt.id !== undefined && opt.id !== null) {
        if (seenIds.has(opt.id)) {
          errors[`questions[${qIdx}].options[${oIdx}].id`] = "Duplicate option identifier.";
        } else {
          seenIds.set(opt.id, oIdx);
        }
      }
    });

    // Rule 1.5 — exactly one correctOptionId matching an existing option.
    const matching = options.filter((o) => o.id === q.correctOptionId);
    if (matching.length !== 1) {
      errors[`questions[${qIdx}].correctOptionId`] = "Select exactly one correct answer.";
    }

    // Rule 1.6 — timeLimit integer 5..300.
    const timeLimit = Number(q.timeLimit);
    if (
      !Number.isInteger(timeLimit) ||
      timeLimit < LIMITS.MIN_TIME_LIMIT ||
      timeLimit > LIMITS.MAX_TIME_LIMIT
    ) {
      errors[`questions[${qIdx}].timeLimit`] = `Time limit must be an integer between ${LIMITS.MIN_TIME_LIMIT} and ${LIMITS.MAX_TIME_LIMIT} seconds.`;
    }

    // Rule 1.7 — pointValue integer 1..10000.
    const pointValue = Number(q.pointValue);
    if (
      !Number.isInteger(pointValue) ||
      pointValue < LIMITS.MIN_POINT_VALUE ||
      pointValue > LIMITS.MAX_POINT_VALUE
    ) {
      errors[`questions[${qIdx}].pointValue`] = `Point value must be an integer between ${LIMITS.MIN_POINT_VALUE} and ${LIMITS.MAX_POINT_VALUE}.`;
    }
  });

  return errors;
}

/**
 * QuestionEditor — isolated editor for a single trivia question. Wrapped in
 * React.memo (like SurveyConfig's QuestionEditor / Raffles' PrizeItem) so
 * editing one question does not re-render siblings and text fields keep focus
 * across keystrokes.
 */
const QuestionEditor = memo(
  ({ question, idx, count, errors, onUpdate, onDelete, onMoveUp, onMoveDown }) => {
    const promptValue = question.prompt ?? "";
    const options = question.options || [];

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
      const removed = options[oIdx];
      const next = options.filter((_, i) => i !== oIdx);
      // If the removed option was the correct one, fall back to the first option.
      const correctOptionId =
        removed && removed.id === question.correctOptionId
          ? next[0]?.id
          : question.correctOptionId;
      onUpdate({ ...question, options: next, correctOptionId });
    };

    const updateNumber = (key, raw) => {
      const value = raw === "" ? "" : parseInt(raw, 10);
      onUpdate({ ...question, [key]: value });
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

        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#374151", mb: 1 }}>
            Answer Options ({options.length}/{LIMITS.MAX_OPTIONS}) — select the correct answer
          </Typography>
          {errors[`questions[${idx}].options`] && (
            <Typography variant="caption" color="error" sx={{ display: "block", mb: 1 }}>
              {errors[`questions[${idx}].options`]}
            </Typography>
          )}
          {errors[`questions[${idx}].correctOptionId`] && (
            <Typography variant="caption" color="error" sx={{ display: "block", mb: 1 }}>
              {errors[`questions[${idx}].correctOptionId`]}
            </Typography>
          )}

          <RadioGroup
            value={question.correctOptionId ?? ""}
            onChange={(e) => onUpdate({ ...question, correctOptionId: e.target.value })}
          >
            {options.map((opt, oIdx) => (
              <Box key={opt.id} sx={{ display: "flex", gap: 1, mb: 1.5, alignItems: "flex-start" }}>
                <FormControlLabel
                  value={opt.id}
                  control={
                    <Radio
                      size="small"
                      sx={{ color: ACCENT, "&.Mui-checked": { color: ACCENT } }}
                      inputProps={{
                        "aria-label": `Mark option ${oIdx + 1} of question ${idx + 1} correct`,
                      }}
                    />
                  }
                  label=""
                  sx={{ mr: 0, mt: 0.5 }}
                />
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
          </RadioGroup>

          <Button
            startIcon={<AddIcon />}
            onClick={addOption}
            disabled={options.length >= LIMITS.MAX_OPTIONS}
            sx={{ textTransform: "none", color: ACCENT }}
          >
            Add Option
          </Button>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5, mt: 2, flexWrap: "wrap" }}>
          <TextField
            size="small"
            type="number"
            label="Time Limit (s)"
            value={question.timeLimit ?? ""}
            onChange={(e) => updateNumber("timeLimit", e.target.value)}
            error={!!errors[`questions[${idx}].timeLimit`]}
            helperText={
              errors[`questions[${idx}].timeLimit`] ||
              `${LIMITS.MIN_TIME_LIMIT}–${LIMITS.MAX_TIME_LIMIT}s`
            }
            inputProps={{ min: LIMITS.MIN_TIME_LIMIT, max: LIMITS.MAX_TIME_LIMIT }}
            sx={{ width: 160 }}
          />
          <TextField
            size="small"
            type="number"
            label="Point Value"
            value={question.pointValue ?? ""}
            onChange={(e) => updateNumber("pointValue", e.target.value)}
            error={!!errors[`questions[${idx}].pointValue`]}
            helperText={
              errors[`questions[${idx}].pointValue`] ||
              `${LIMITS.MIN_POINT_VALUE}–${LIMITS.MAX_POINT_VALUE}`
            }
            inputProps={{ min: LIMITS.MIN_POINT_VALUE, max: LIMITS.MAX_POINT_VALUE }}
            sx={{ width: 160 }}
          />
        </Box>
      </Box>
    );
  }
);

QuestionEditor.displayName = "QuestionEditor";

/**
 * TriviaConfig — organizer-facing configuration screen for a Trivia Challenges
 * experience instance. Mirrors SurveyConfig/RaffleConfig's stepped MUI form: an
 * errors map keyed by field path, memoized question editors, client-side
 * validation reproducing the plugin rules, and a save that persists the config
 * via updateInstance.
 */
const TriviaConfig = () => {
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
            accentColor: cfg.accentColor || DEFAULT_ACCENT,
            speedBonus: SPEED_BONUS_VALUES.includes(cfg.speedBonus) ? cfg.speedBonus : "off",
            questions: cfg.questions.map((q, qi) => {
              const opts = q.options?.length ? q.options : [makeOption(), makeOption()];
              const options = opts.map((o, oi) => ({
                id: o.id || `${q.id || qi}-opt-${oi}`,
                label: o.label ?? "",
              }));
              return {
                id: q.id || uid("q"),
                prompt: q.prompt ?? "",
                options,
                correctOptionId:
                  q.correctOptionId && options.some((o) => o.id === q.correctOptionId)
                    ? q.correctOptionId
                    : options[0].id,
                timeLimit: q.timeLimit ?? 20,
                pointValue: q.pointValue ?? 100,
              };
            }),
          });
        }
      } catch (err) {
        // Non-fatal: a brand-new instance has no config yet.
        console.log("TriviaConfig: no existing config", err?.message);
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
        : { ...prev, questions: [...prev.questions, makeQuestion()] }
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
  // questions array so the config persists the new order (Requirement 8.6).
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
        accentColor: form.accentColor || DEFAULT_ACCENT,
        speedBonus: form.speedBonus,
        questions: form.questions.map((q) => ({
          id: q.id,
          prompt: q.prompt.trim(),
          options: q.options.map((o) => ({ id: o.id, label: o.label.trim() })),
          correctOptionId: q.correctOptionId,
          timeLimit: Number(q.timeLimit),
          pointValue: Number(q.pointValue),
        })),
      };
      await updateInstance(eventId, experienceId, { config });
      setSaved(true);
      // Return to the engagements dashboard after a successful save (matches Raffle).
      navigate(`/admin/my-events/${eventId}/experiences`);
    } catch (err) {
      setSaveError(
        err.response?.data?.message || err.message || "Failed to save trivia configuration."
      );
    } finally {
      setSaving(false);
    }
  };

  const renderQuestionsStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Questions ({form.questions.length}/{LIMITS.MAX_QUESTIONS})
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Author your trivia questions. Set a prompt, answer options, the correct answer, a countdown time limit, and a point value for each.
      </Typography>

      <ThemeColorPicker
        value={form.accentColor}
        onChange={(hex) => {
          setForm((prev) => ({ ...prev, accentColor: hex }));
          setSaved(false);
        }}
        helper="Accent color used across this trivia challenge's display"
      />

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

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Scoring &amp; Review
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Choose whether faster correct answers earn a speed bonus, then save the configuration to this experience.
      </Typography>

      <FormControl size="small" sx={{ minWidth: 220, mb: 2 }} error={!!errors["speedBonus"]}>
        <InputLabel id="speed-bonus-label">Speed Bonus</InputLabel>
        <Select
          labelId="speed-bonus-label"
          label="Speed Bonus"
          value={form.speedBonus}
          onChange={(e) => {
            const value = e.target.value;
            setForm((prev) => ({ ...prev, speedBonus: value }));
            setSaved(false);
          }}
        >
          <MenuItem value="off">Off — correct answers earn the point value</MenuItem>
          <MenuItem value="on">On — faster correct answers earn more</MenuItem>
        </Select>
      </FormControl>

      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#F8F9FA" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>
          {form.questions.length} question{form.questions.length === 1 ? "" : "s"} · Speed bonus {form.speedBonus}
        </Typography>
        {form.questions.map((q, idx) => (
          <Box key={q.id} sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
              {idx + 1}. {q.prompt || `Question ${idx + 1}`}{" "}
              <Typography component="span" sx={{ fontSize: 12, color: "#6B7280" }}>
                ({q.timeLimit}s · {q.pointValue} pts)
              </Typography>
            </Typography>
          </Box>
        ))}
      </Box>

    </Box>
  );

  const renderStep = () => {
    if (activeStep === 0) return renderQuestionsStep();
    return renderReviewStep();
  };

  return (
    <EngagementConfigShell
      title="Configure Trivia Challenges"
      subtitle="Author timed trivia questions with a correct answer and leaderboard scoring."
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

export default TriviaConfig;
