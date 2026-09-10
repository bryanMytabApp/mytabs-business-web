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
  Switch,
  FormControlLabel,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { DateTimePicker } from "@mui/x-date-pickers/DateTimePicker";
import dayjs from "dayjs";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import { getInstance, updateInstance } from "../../services/experienceService";
import ThemeColorPicker from "./ThemeColorPicker";
import EngagementConfigShell from "./EngagementConfigShell";

const ACCENT = "#3B82F6"; // Feedback & Surveys brand color
const DEFAULT_ACCENT = "#3B82F6"; // default theme color saved when none chosen

// Config limits — mirror the plugin's validateConfig rules (Requirement 1).
const LIMITS = {
  MIN_POLLS: 1,
  MAX_POLLS: 50,
  MAX_QUESTION: 200,
  MIN_OPTIONS: 2,
  MAX_OPTIONS: 10,
  MAX_LABEL: 100,
};

const STEPS = ["Polls", "Schedule", "Review & Save"];

let idCounter = 0;
const uid = (prefix) => `${prefix}-${Date.now()}-${idCounter++}`;

const makeOption = () => ({ id: uid("opt"), label: "" });

const makePoll = () => ({
  id: uid("poll"),
  question: "",
  selectionMode: "single",
  maxSelections: 2,
  options: [makeOption(), makeOption()],
  // Optional automatic open/close window (dayjs objects in form state, ISO on
  // save). null means "manual mode" — the poll is opened/closed by hand from
  // the live dashboard, matching the legacy behavior.
  scheduledOpenAt: null,
  scheduledCloseAt: null,
});

const DEFAULT_FORM = { accentColor: DEFAULT_ACCENT, polls: [makePoll()] };

/**
 * Validates the poll configuration form, reproducing the backend plugin rules
 * (Requirement 1.2–1.8) into an errors map keyed by field path so each control
 * can surface its own error. Returns an object of { fieldPath: message }.
 */
export function validateAll(form) {
  const errors = {};
  const polls = form?.polls || [];

  // Rule 1.2 — poll count 1..50.
  if (polls.length < LIMITS.MIN_POLLS) {
    errors["polls"] = `At least ${LIMITS.MIN_POLLS} poll is required.`;
  } else if (polls.length > LIMITS.MAX_POLLS) {
    errors["polls"] = `A maximum of ${LIMITS.MAX_POLLS} polls is allowed.`;
  }

  polls.forEach((poll, pIdx) => {
    // Rule 1.3 — question length 1..200.
    const question = poll.question ?? "";
    if (question.trim().length < 1) {
      errors[`polls[${pIdx}].question`] = "Question is required.";
    } else if (question.length > LIMITS.MAX_QUESTION) {
      errors[`polls[${pIdx}].question`] = `Question must be ${LIMITS.MAX_QUESTION} characters or fewer.`;
    }

    // Rule 1.6 — selection mode membership.
    if (poll.selectionMode !== "single" && poll.selectionMode !== "multiple") {
      errors[`polls[${pIdx}].selectionMode`] = "Selection mode must be single or multiple.";
    }

    // Rule 1.4 — option count 2..10.
    const options = poll.options || [];
    if (options.length < LIMITS.MIN_OPTIONS) {
      errors[`polls[${pIdx}].options`] = `At least ${LIMITS.MIN_OPTIONS} options are required.`;
    } else if (options.length > LIMITS.MAX_OPTIONS) {
      errors[`polls[${pIdx}].options`] = `A maximum of ${LIMITS.MAX_OPTIONS} options is allowed.`;
    }

    // Rule 1.5 — option label length 1..100.
    // Rule 1.8 — no duplicate labels within a poll.
    const seen = new Map();
    options.forEach((opt, oIdx) => {
      const label = opt.label ?? "";
      if (label.trim().length < 1) {
        errors[`polls[${pIdx}].options[${oIdx}].label`] = "Option label is required.";
      } else if (label.length > LIMITS.MAX_LABEL) {
        errors[`polls[${pIdx}].options[${oIdx}].label`] = `Label must be ${LIMITS.MAX_LABEL} characters or fewer.`;
      } else {
        const key = label.trim().toLowerCase();
        if (seen.has(key)) {
          errors[`polls[${pIdx}].options[${oIdx}].label`] = "Duplicate option label.";
        } else {
          seen.set(key, oIdx);
        }
      }
    });

    // Rule 1.7 — multiple-mode maxSelections integer in [2, options.length].
    if (poll.selectionMode === "multiple") {
      const max = Number(poll.maxSelections);
      if (!Number.isInteger(max) || max < 2 || max > options.length) {
        errors[`polls[${pIdx}].maxSelections`] = `Max selections must be between 2 and ${options.length}.`;
      }
    }

    // Schedule window (optional) — mirrors the plugin's validatePollSchedule:
    // each bound, when present, must be a valid date-time, and close must be
    // strictly after open. Absent bounds leave the poll in manual mode.
    const open = poll.scheduledOpenAt;
    const close = poll.scheduledCloseAt;
    const openValid = open == null || (dayjs.isDayjs(open) ? open.isValid() : dayjs(open).isValid());
    const closeValid = close == null || (dayjs.isDayjs(close) ? close.isValid() : dayjs(close).isValid());
    if (open != null && !openValid) {
      errors[`polls[${pIdx}].scheduledOpenAt`] = "Open time must be a valid date and time.";
    }
    if (close != null && !closeValid) {
      errors[`polls[${pIdx}].scheduledCloseAt`] = "Close time must be a valid date and time.";
    }
    if (open != null && close != null && openValid && closeValid) {
      const openMs = dayjs(open).valueOf();
      const closeMs = dayjs(close).valueOf();
      if (closeMs <= openMs) {
        errors[`polls[${pIdx}].scheduledCloseAt`] = "Close time must be after the open time.";
      }
    }
  });

  return errors;
}

/**
 * PollEditor — isolated editor for a single poll. Wrapped in React.memo (like
 * RaffleConfig's PrizeItem) so editing one poll does not re-render siblings and
 * text fields keep their focus across keystrokes.
 */
const PollEditor = memo(({ poll, idx, errors, onUpdate, onDelete, canDelete }) => {
  const options = poll.options || [];
  const questionValue = poll.question ?? "";

  const updateOption = (oIdx, label) => {
    const next = options.map((o, i) => (i === oIdx ? { ...o, label } : o));
    onUpdate({ ...poll, options: next });
  };

  const addOption = () => {
    if (options.length >= LIMITS.MAX_OPTIONS) return;
    onUpdate({ ...poll, options: [...options, makeOption()] });
  };

  const removeOption = (oIdx) => {
    if (options.length <= LIMITS.MIN_OPTIONS) return;
    onUpdate({ ...poll, options: options.filter((_, i) => i !== oIdx) });
  };

  const changeMode = (mode) => {
    // When switching to multiple, seed a valid maxSelections default.
    const maxSelections =
      mode === "multiple"
        ? Math.min(Math.max(Number(poll.maxSelections) || 2, 2), options.length)
        : 1;
    onUpdate({ ...poll, selectionMode: mode, maxSelections });
  };

  return (
    <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
          Poll {idx + 1}
        </Typography>
        {canDelete && (
          <IconButton size="small" aria-label={`Remove poll ${idx + 1}`} onClick={onDelete}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <TextField
        fullWidth
        size="small"
        label="Question"
        value={questionValue}
        onChange={(e) => onUpdate({ ...poll, question: e.target.value })}
        error={!!errors[`polls[${idx}].question`]}
        helperText={errors[`polls[${idx}].question`] || `${questionValue.length}/${LIMITS.MAX_QUESTION}`}
        inputProps={{ maxLength: LIMITS.MAX_QUESTION + 1 }}
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 180 }} error={!!errors[`polls[${idx}].selectionMode`]}>
          <InputLabel id={`mode-label-${idx}`}>Selection Mode</InputLabel>
          <Select
            labelId={`mode-label-${idx}`}
            label="Selection Mode"
            value={poll.selectionMode}
            onChange={(e) => changeMode(e.target.value)}
          >
            <MenuItem value="single">Single choice</MenuItem>
            <MenuItem value="multiple">Multiple choice</MenuItem>
          </Select>
        </FormControl>

        {poll.selectionMode === "multiple" && (
          <TextField
            size="small"
            type="number"
            label="Max Selections"
            value={poll.maxSelections ?? ""}
            onChange={(e) => {
              const raw = e.target.value;
              onUpdate({ ...poll, maxSelections: raw === "" ? "" : parseInt(raw, 10) });
            }}
            error={!!errors[`polls[${idx}].maxSelections`]}
            helperText={errors[`polls[${idx}].maxSelections`] || `2–${options.length}`}
            inputProps={{ min: 2, max: options.length }}
            sx={{ width: 160 }}
          />
        )}
      </Box>

      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#374151", mb: 1 }}>
        Answer Options ({options.length}/{LIMITS.MAX_OPTIONS})
      </Typography>
      {errors[`polls[${idx}].options`] && (
        <Typography variant="caption" color="error" sx={{ display: "block", mb: 1 }}>
          {errors[`polls[${idx}].options`]}
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
            error={!!errors[`polls[${idx}].options[${oIdx}].label`]}
            helperText={errors[`polls[${idx}].options[${oIdx}].label`] || `${(opt.label ?? "").length}/${LIMITS.MAX_LABEL}`}
            inputProps={{ maxLength: LIMITS.MAX_LABEL + 1 }}
          />
          <IconButton
            size="small"
            aria-label={`Remove option ${oIdx + 1}`}
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
  );
});

PollEditor.displayName = "PollEditor";

/**
 * PollScheduleEditor — per-poll optional open/close scheduling card. Mirrors the
 * Raffle config's entry-window pattern (DateTimePicker + LocalizationProvider),
 * scoped to a single poll. When scheduling is off the poll stays in manual mode
 * (opened/closed by hand from the live dashboard). Memoized so editing one
 * poll's schedule does not re-render the others.
 */
const PollScheduleEditor = memo(({ poll, idx, errors, onUpdate }) => {
  const scheduled = poll.scheduledOpenAt != null || poll.scheduledCloseAt != null;

  const toggleScheduling = (on) => {
    if (on) {
      // Seed a sensible default window: opens now, closes in an hour.
      const start = poll.scheduledOpenAt || dayjs();
      const end = poll.scheduledCloseAt || dayjs().add(1, "hour");
      onUpdate({ ...poll, scheduledOpenAt: start, scheduledCloseAt: end });
    } else {
      onUpdate({ ...poll, scheduledOpenAt: null, scheduledCloseAt: null });
    }
  };

  return (
    <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
          Poll {idx + 1}: {poll.question?.trim() || `Poll ${idx + 1}`}
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={scheduled}
              onChange={(e) => toggleScheduling(e.target.checked)}
              size="small"
              inputProps={{ "aria-label": `Schedule poll ${idx + 1}` }}
            />
          }
          label={<Typography sx={{ fontSize: 12, color: "#6B7280" }}>Auto open/close</Typography>}
          sx={{ mr: 0 }}
        />
      </Box>

      {scheduled ? (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mt: 1 }}>
            <DateTimePicker
              label="Opens at"
              value={poll.scheduledOpenAt || null}
              onChange={(v) => onUpdate({ ...poll, scheduledOpenAt: v })}
              slotProps={{
                textField: {
                  size: "small",
                  error: !!errors[`polls[${idx}].scheduledOpenAt`],
                  helperText: errors[`polls[${idx}].scheduledOpenAt`] || "",
                  sx: { minWidth: 220 },
                },
              }}
            />
            <DateTimePicker
              label="Closes at"
              value={poll.scheduledCloseAt || null}
              onChange={(v) => onUpdate({ ...poll, scheduledCloseAt: v })}
              slotProps={{
                textField: {
                  size: "small",
                  error: !!errors[`polls[${idx}].scheduledCloseAt`],
                  helperText: errors[`polls[${idx}].scheduledCloseAt`] || "",
                  sx: { minWidth: 220 },
                },
              }}
            />
          </Box>
          <Typography sx={{ fontSize: 12, color: "#6B7280", mt: 1 }}>
            Votes are accepted automatically while the event is Live and the current
            time is within this window. You can still close it early from the
            dashboard.
          </Typography>
        </LocalizationProvider>
      ) : (
        <Typography sx={{ fontSize: 12, color: "#9CA3AF", mt: 0.5 }}>
          Manual mode — you'll open and close this poll yourself from the live dashboard.
        </Typography>
      )}
    </Box>
  );
});

PollScheduleEditor.displayName = "PollScheduleEditor";

/**
 * LivePollConfig — organizer-facing configuration screen for a Live Polls
 * experience instance. Mirrors RaffleConfig's stepped MUI form: an errors map
 * keyed by field path, memoized poll editors, client-side validation that
 * reproduces the plugin rules, and a save that persists the config via
 * updateInstance.
 */
const LivePollConfig = () => {
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
        if (!cancelled && cfg?.polls?.length) {
          setForm({
            accentColor: cfg.accentColor || DEFAULT_ACCENT,
            polls: cfg.polls.map((p, pi) => ({
              id: p.id || uid("poll"),
              question: p.question ?? "",
              selectionMode: p.selectionMode === "multiple" ? "multiple" : "single",
              maxSelections: p.maxSelections ?? 2,
              options: (p.options?.length ? p.options : [makeOption(), makeOption()]).map((o, oi) => ({
                id: o.id || `${p.id || pi}-opt-${oi}`,
                label: o.label ?? "",
              })),
              // Hydrate schedule ISO strings back into dayjs objects (null = manual).
              scheduledOpenAt: p.scheduledOpenAt ? dayjs(p.scheduledOpenAt) : null,
              scheduledCloseAt: p.scheduledCloseAt ? dayjs(p.scheduledCloseAt) : null,
            })),
          });
        }
      } catch (err) {
        // Non-fatal: a brand-new instance has no config yet.
        console.log("LivePollConfig: no existing config", err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, experienceId]);

  const updatePoll = (idx, updatedPoll) => {
    setForm((prev) => ({
      ...prev,
      polls: prev.polls.map((p, i) => (i === idx ? updatedPoll : p)),
    }));
    setSaved(false);
  };

  const addPoll = () => {
    setForm((prev) =>
      prev.polls.length >= LIMITS.MAX_POLLS ? prev : { ...prev, polls: [...prev.polls, makePoll()] }
    );
    setSaved(false);
  };

  const removePoll = (idx) => {
    setForm((prev) =>
      prev.polls.length <= LIMITS.MIN_POLLS
        ? prev
        : { ...prev, polls: prev.polls.filter((_, i) => i !== idx) }
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
        polls: form.polls.map((p) => {
          const poll = {
            id: p.id,
            question: p.question.trim(),
            selectionMode: p.selectionMode,
            maxSelections: p.selectionMode === "multiple" ? Number(p.maxSelections) : 1,
            options: p.options.map((o) => ({ id: o.id, label: o.label.trim() })),
          };
          // Persist the schedule window as ISO 8601 only when set; omit the
          // fields entirely for manual-mode polls so the backend treats them as
          // unscheduled (matching the plugin's "no window = manual" contract).
          if (p.scheduledOpenAt) poll.scheduledOpenAt = dayjs(p.scheduledOpenAt).toISOString();
          if (p.scheduledCloseAt) poll.scheduledCloseAt = dayjs(p.scheduledCloseAt).toISOString();
          return poll;
        }),
      };
      await updateInstance(eventId, experienceId, { config });
      setSaved(true);
      // Return to the engagements dashboard after a successful save (matches Raffle).
      navigate(`/admin/my-events/${eventId}/experiences`);
    } catch (err) {
      setSaveError(
        err.response?.data?.message || err.message || "Failed to save poll configuration."
      );
    } finally {
      setSaving(false);
    }
  };

  const renderPollsStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Polls ({form.polls.length}/{LIMITS.MAX_POLLS})
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Author the questions attendees will vote on. Each poll needs a question and 2–10 options.
      </Typography>

      <ThemeColorPicker
        value={form.accentColor}
        onChange={(hex) => {
          setForm((prev) => ({ ...prev, accentColor: hex }));
          setSaved(false);
        }}
        helper="Accent color used across this poll's display"
      />

      {errors["polls"] && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {errors["polls"]}
        </Alert>
      )}

      {form.polls.map((poll, idx) => (
        <PollEditor
          key={poll.id}
          poll={poll}
          idx={idx}
          errors={errors}
          canDelete={form.polls.length > LIMITS.MIN_POLLS}
          onUpdate={(updated) => updatePoll(idx, updated)}
          onDelete={() => removePoll(idx)}
        />
      ))}

      <Button
        startIcon={<AddIcon />}
        onClick={addPoll}
        disabled={form.polls.length >= LIMITS.MAX_POLLS}
        variant="outlined"
        sx={{ textTransform: "none", borderColor: ACCENT, color: ACCENT }}
      >
        Add Poll
      </Button>
    </Box>
  );

  const renderScheduleStep = () => (
    <Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <ScheduleOutlinedIcon sx={{ color: ACCENT, fontSize: 20 }} />
        <Typography variant="h6">Schedule (optional)</Typography>
      </Box>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Give a poll an automatic open/close window and it will start and stop
        accepting votes on its own while the event is Live — no manual button
        needed. Leave it off to open and close the poll yourself.
      </Typography>

      {form.polls.map((poll, idx) => (
        <PollScheduleEditor
          key={poll.id}
          poll={poll}
          idx={idx}
          errors={errors}
          onUpdate={(updated) => updatePoll(idx, updated)}
        />
      ))}
    </Box>
  );

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Review &amp; Save
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Confirm your polls, then save the configuration to this experience.
      </Typography>

      {form.polls.map((poll, idx) => {
        const hasSchedule = poll.scheduledOpenAt != null || poll.scheduledCloseAt != null;
        const fmt = (v) => (v ? dayjs(v).format("MMM D, YYYY h:mm A") : "—");
        return (
          <Box key={poll.id} sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#F8F9FA" }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14, mb: 0.5 }}>
              {poll.question || `Poll ${idx + 1}`}
            </Typography>
            <Typography sx={{ fontSize: 12, color: "#6B7280", mb: 1 }}>
              {poll.selectionMode === "multiple"
                ? `Multiple choice · up to ${poll.maxSelections} selections`
                : "Single choice"}
            </Typography>
            {poll.options.map((o, oi) => (
              <Typography key={o.id} sx={{ fontSize: 13, color: "#374151" }}>
                • {o.label || `Option ${oi + 1}`}
              </Typography>
            ))}
            <Typography sx={{ fontSize: 12, color: "#6B7280", mt: 1, display: "flex", alignItems: "center", gap: 0.5 }}>
              <ScheduleOutlinedIcon sx={{ fontSize: 14 }} />
              {hasSchedule
                ? `Auto: opens ${fmt(poll.scheduledOpenAt)} · closes ${fmt(poll.scheduledCloseAt)}`
                : "Manual open/close"}
            </Typography>
          </Box>
        );
      })}

    </Box>
  );

  return (
    <EngagementConfigShell
      title="Configure Live Polls"
      subtitle="Author single- and multiple-choice polls for your event."
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
      {activeStep === 0
        ? renderPollsStep()
        : activeStep === 1
        ? renderScheduleStep()
        : renderReviewStep()}
    </EngagementConfigShell>
  );
};

export default LivePollConfig;
