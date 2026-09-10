import React, { useState, useEffect, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import InsightsOutlinedIcon from "@mui/icons-material/InsightsOutlined";
import { getInstance, updateInstance } from "../../services/experienceService";

const ACCENT = "#22C55E"; // Games & Challenges brand color

// Config limits — mirror the plugin's validateConfig rules (Requirement 1).
const LIMITS = {
  MIN_MARKETS: 1,
  MAX_MARKETS: 50,
  MAX_QUESTION: 300,
  MIN_OPTIONS: 2,
  MAX_OPTIONS: 10,
  MAX_LABEL: 150,
  MIN_POINT_VALUE: 1,
  MAX_POINT_VALUE: 10000,
};

const STEPS = ["Markets", "Review"];

let idCounter = 0;
const uid = (prefix) => `${prefix}-${Date.now()}-${idCounter++}`;

const makeOption = () => ({ id: uid("opt"), label: "" });

// Default a new market's close deadline roughly a day out so it is a future
// timestamp on creation; the organizer adjusts it.
const defaultDeadline = () => {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return d.toISOString();
};

const makeMarket = () => ({
  id: uid("m"),
  question: "",
  options: [makeOption(), makeOption()],
  closeDeadline: defaultDeadline(),
  pointValue: 50,
});

const DEFAULT_FORM = {
  markets: [makeMarket()],
};

// Convert an ISO string into the value shape a datetime-local input expects
// (YYYY-MM-DDTHH:mm), in local time. Returns "" for missing/invalid values.
function isoToLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

// Convert a datetime-local input value back to an ISO string. Returns "" for
// empty/invalid input so validation can flag it.
function localInputToIso(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

/**
 * Validates the prediction configuration form, reproducing the backend plugin
 * rules (Requirements 1.2–1.7) into an errors map keyed by field path (e.g.
 * `markets[0].options[2].label`) so each control can surface its own error.
 * Returns an object of { fieldPath: message }. The plugin's validateConfig
 * remains the server-side authority.
 */
export function validateAll(form) {
  const errors = {};
  const now = Date.now();

  // Rule 1.2 — market count 1..50.
  const markets = form?.markets || [];
  if (markets.length < LIMITS.MIN_MARKETS) {
    errors["markets"] = `At least ${LIMITS.MIN_MARKETS} market is required.`;
  } else if (markets.length > LIMITS.MAX_MARKETS) {
    errors["markets"] = `A maximum of ${LIMITS.MAX_MARKETS} markets is allowed.`;
  }

  markets.forEach((m, mIdx) => {
    // Rule 1.3 — question length 1..300.
    const question = m.question ?? "";
    if (question.trim().length < 1) {
      errors[`markets[${mIdx}].question`] = "Market question is required.";
    } else if (question.length > LIMITS.MAX_QUESTION) {
      errors[`markets[${mIdx}].question`] = `Question must be ${LIMITS.MAX_QUESTION} characters or fewer.`;
    }

    // Rule 1.4 — option count 2..10, unique ids, each label 1..150.
    const options = m.options || [];
    if (options.length < LIMITS.MIN_OPTIONS) {
      errors[`markets[${mIdx}].options`] = `At least ${LIMITS.MIN_OPTIONS} outcomes are required.`;
    } else if (options.length > LIMITS.MAX_OPTIONS) {
      errors[`markets[${mIdx}].options`] = `A maximum of ${LIMITS.MAX_OPTIONS} outcomes is allowed.`;
    }

    const seenIds = new Map();
    options.forEach((opt, oIdx) => {
      const label = opt.label ?? "";
      if (label.trim().length < 1) {
        errors[`markets[${mIdx}].options[${oIdx}].label`] = "Outcome label is required.";
      } else if (label.length > LIMITS.MAX_LABEL) {
        errors[`markets[${mIdx}].options[${oIdx}].label`] = `Label must be ${LIMITS.MAX_LABEL} characters or fewer.`;
      }
      // Rule 1.7 — duplicate option identifiers within a market, flagged at the
      // offending option.
      if (opt.id !== undefined && opt.id !== null) {
        if (seenIds.has(opt.id)) {
          errors[`markets[${mIdx}].options[${oIdx}].id`] = "Duplicate outcome identifier.";
        } else {
          seenIds.set(opt.id, oIdx);
        }
      }
    });

    // Rule 1.5 — closeDeadline is a valid future timestamp.
    const iso = m.closeDeadline;
    const ts = iso ? new Date(iso).getTime() : NaN;
    if (!iso || Number.isNaN(ts)) {
      errors[`markets[${mIdx}].closeDeadline`] = "A close deadline is required.";
    } else if (ts <= now) {
      errors[`markets[${mIdx}].closeDeadline`] = "Close deadline must be in the future.";
    }

    // Rule 1.6 — pointValue integer 1..10000.
    const pointValue = Number(m.pointValue);
    if (
      !Number.isInteger(pointValue) ||
      pointValue < LIMITS.MIN_POINT_VALUE ||
      pointValue > LIMITS.MAX_POINT_VALUE
    ) {
      errors[`markets[${mIdx}].pointValue`] = `Point value must be an integer between ${LIMITS.MIN_POINT_VALUE} and ${LIMITS.MAX_POINT_VALUE}.`;
    }
  });

  return errors;
}

/**
 * MarketEditor — isolated editor for a single prediction market. Wrapped in
 * React.memo (like TriviaConfig's QuestionEditor / Raffles' PrizeItem) so
 * editing one market does not re-render siblings and text fields keep focus
 * across keystrokes. There is NO correct-answer selector: the actual outcome is
 * declared at resolve time on the dashboard, not at config time.
 */
const MarketEditor = memo(
  ({ market, idx, count, errors, onUpdate, onDelete, onMoveUp, onMoveDown }) => {
    const questionValue = market.question ?? "";
    const options = market.options || [];

    const updateOption = (oIdx, label) => {
      const next = options.map((o, i) => (i === oIdx ? { ...o, label } : o));
      onUpdate({ ...market, options: next });
    };

    const addOption = () => {
      if (options.length >= LIMITS.MAX_OPTIONS) return;
      onUpdate({ ...market, options: [...options, makeOption()] });
    };

    const removeOption = (oIdx) => {
      if (options.length <= LIMITS.MIN_OPTIONS) return;
      const next = options.filter((_, i) => i !== oIdx);
      onUpdate({ ...market, options: next });
    };

    const updateNumber = (key, raw) => {
      const value = raw === "" ? "" : parseInt(raw, 10);
      onUpdate({ ...market, [key]: value });
    };

    return (
      <Box
        data-testid={`market-editor-${idx}`}
        sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
            Market {idx + 1}
          </Typography>
          <Box>
            <IconButton
              size="small"
              aria-label={`Move market ${idx + 1} up`}
              onClick={onMoveUp}
              disabled={idx === 0}
            >
              <ArrowUpwardIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label={`Move market ${idx + 1} down`}
              onClick={onMoveDown}
              disabled={idx === count - 1}
            >
              <ArrowDownwardIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              aria-label={`Remove market ${idx + 1}`}
              onClick={onDelete}
              disabled={count <= LIMITS.MIN_MARKETS}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <TextField
          fullWidth
          size="small"
          label="Question"
          value={questionValue}
          onChange={(e) => onUpdate({ ...market, question: e.target.value })}
          error={!!errors[`markets[${idx}].question`]}
          helperText={errors[`markets[${idx}].question`] || `${questionValue.length}/${LIMITS.MAX_QUESTION}`}
          inputProps={{ maxLength: LIMITS.MAX_QUESTION + 1 }}
          sx={{ mb: 2 }}
        />

        <Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#374151", mb: 1 }}>
            Outcomes ({options.length}/{LIMITS.MAX_OPTIONS})
          </Typography>
          {errors[`markets[${idx}].options`] && (
            <Typography variant="caption" color="error" sx={{ display: "block", mb: 1 }}>
              {errors[`markets[${idx}].options`]}
            </Typography>
          )}

          {options.map((opt, oIdx) => (
            <Box key={opt.id} sx={{ display: "flex", gap: 1, mb: 1.5, alignItems: "flex-start" }}>
              <TextField
                fullWidth
                size="small"
                label={`Outcome ${oIdx + 1}`}
                value={opt.label ?? ""}
                onChange={(e) => updateOption(oIdx, e.target.value)}
                error={
                  !!errors[`markets[${idx}].options[${oIdx}].label`] ||
                  !!errors[`markets[${idx}].options[${oIdx}].id`]
                }
                helperText={
                  errors[`markets[${idx}].options[${oIdx}].label`] ||
                  errors[`markets[${idx}].options[${oIdx}].id`] ||
                  `${(opt.label ?? "").length}/${LIMITS.MAX_LABEL}`
                }
                inputProps={{ maxLength: LIMITS.MAX_LABEL + 1 }}
              />
              <IconButton
                size="small"
                aria-label={`Remove outcome ${oIdx + 1} of market ${idx + 1}`}
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
            Add Outcome
          </Button>
        </Box>

        <Box sx={{ display: "flex", gap: 1.5, mt: 2, flexWrap: "wrap" }}>
          <TextField
            size="small"
            type="datetime-local"
            label="Close Deadline"
            value={isoToLocalInput(market.closeDeadline)}
            onChange={(e) => onUpdate({ ...market, closeDeadline: localInputToIso(e.target.value) })}
            error={!!errors[`markets[${idx}].closeDeadline`]}
            helperText={errors[`markets[${idx}].closeDeadline`] || "Predictions close at this time"}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 240 }}
          />
          <TextField
            size="small"
            type="number"
            label="Point Value"
            value={market.pointValue ?? ""}
            onChange={(e) => updateNumber("pointValue", e.target.value)}
            error={!!errors[`markets[${idx}].pointValue`]}
            helperText={
              errors[`markets[${idx}].pointValue`] ||
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

MarketEditor.displayName = "MarketEditor";

/**
 * PredictionConfig — organizer-facing configuration screen for a Prediction
 * Challenges experience instance. Mirrors TriviaConfig/RaffleConfig's stepped
 * MUI form: an errors map keyed by field path, memoized market editors,
 * client-side validation reproducing the plugin rules, and a save that persists
 * the config via updateInstance. Unlike Trivia there is no speed bonus and no
 * correct-answer selector — the actual outcome is declared at resolve time.
 */
const PredictionConfig = () => {
  const { eventId, experienceId } = useParams();
  const navigate = useNavigate();

  const [activeStep, setActiveStep] = useState(0);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  // Load any existing config so the organizer edits rather than overwrites.
  useEffect(() => {
    if (!eventId || !experienceId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getInstance(eventId, experienceId);
        const instance = res.data?.data || res.data;
        const cfg = instance?.config;
        if (!cancelled && cfg?.markets?.length) {
          setForm({
            markets: cfg.markets.map((m, mi) => {
              const opts = m.options?.length ? m.options : [makeOption(), makeOption()];
              const options = opts.map((o, oi) => ({
                id: o.id || `${m.id || mi}-opt-${oi}`,
                label: o.label ?? "",
              }));
              return {
                id: m.id || uid("m"),
                question: m.question ?? "",
                options,
                closeDeadline: m.closeDeadline || defaultDeadline(),
                pointValue: m.pointValue ?? 50,
              };
            }),
          });
        }
      } catch (err) {
        // Non-fatal: a brand-new instance has no config yet.
        console.log("PredictionConfig: no existing config", err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, experienceId]);

  const updateMarket = (idx, updatedMarket) => {
    setForm((prev) => ({
      ...prev,
      markets: prev.markets.map((m, i) => (i === idx ? updatedMarket : m)),
    }));
    setSaved(false);
  };

  const addMarket = () => {
    setForm((prev) =>
      prev.markets.length >= LIMITS.MAX_MARKETS
        ? prev
        : { ...prev, markets: [...prev.markets, makeMarket()] }
    );
    setSaved(false);
  };

  const removeMarket = (idx) => {
    setForm((prev) =>
      prev.markets.length <= LIMITS.MIN_MARKETS
        ? prev
        : { ...prev, markets: prev.markets.filter((_, i) => i !== idx) }
    );
    setSaved(false);
  };

  // Reorder by swapping the target market with its neighbor. Rewrites the
  // markets array so the config persists the new order (Requirement 9.5).
  const moveMarket = (idx, delta) => {
    setForm((prev) => {
      const target = idx + delta;
      if (target < 0 || target >= prev.markets.length) return prev;
      const markets = [...prev.markets];
      [markets[idx], markets[target]] = [markets[target], markets[idx]];
      return { ...prev, markets };
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
        markets: form.markets.map((m) => ({
          id: m.id,
          question: m.question.trim(),
          options: m.options.map((o) => ({ id: o.id, label: o.label.trim() })),
          closeDeadline: m.closeDeadline,
          pointValue: Number(m.pointValue),
        })),
      };
      await updateInstance(eventId, experienceId, { config });
      setSaved(true);
    } catch (err) {
      setSaveError(
        err.response?.data?.message || err.message || "Failed to save prediction configuration."
      );
    } finally {
      setSaving(false);
    }
  };

  const renderMarketsStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Markets ({form.markets.length}/{LIMITS.MAX_MARKETS})
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Author your prediction markets. Set a question, the possible outcomes, a close deadline, and a point value for each. The winning outcome is declared later when you resolve the market.
      </Typography>

      {errors["markets"] && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {errors["markets"]}
        </Alert>
      )}

      {form.markets.map((market, idx) => (
        <MarketEditor
          key={market.id}
          market={market}
          idx={idx}
          count={form.markets.length}
          errors={errors}
          onUpdate={(updated) => updateMarket(idx, updated)}
          onDelete={() => removeMarket(idx)}
          onMoveUp={() => moveMarket(idx, -1)}
          onMoveDown={() => moveMarket(idx, 1)}
        />
      ))}

      <Button
        startIcon={<AddIcon />}
        onClick={addMarket}
        disabled={form.markets.length >= LIMITS.MAX_MARKETS}
        variant="outlined"
        sx={{ textTransform: "none", borderColor: ACCENT, color: ACCENT }}
      >
        Add Market
      </Button>
    </Box>
  );

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Review
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Review the prediction markets, then save the configuration to this experience.
      </Typography>

      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#F8F9FA" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>
          {form.markets.length} market{form.markets.length === 1 ? "" : "s"}
        </Typography>
        {form.markets.map((m, idx) => {
          const deadline = m.closeDeadline ? new Date(m.closeDeadline) : null;
          const deadlineLabel =
            deadline && !Number.isNaN(deadline.getTime())
              ? deadline.toLocaleString()
              : "no deadline set";
          return (
            <Box key={m.id} sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                {idx + 1}. {m.question || `Market ${idx + 1}`}{" "}
                <Typography component="span" sx={{ fontSize: 12, color: "#6B7280" }}>
                  ({m.options.length} outcomes · {m.pointValue} pts · closes {deadlineLabel})
                </Typography>
              </Typography>
            </Box>
          );
        })}
      </Box>

      {saveError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {saveError}
        </Alert>
      )}
      {saved && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
          Prediction configuration saved.
        </Alert>
      )}

      <Button
        variant="contained"
        onClick={handleSave}
        disabled={saving}
        sx={{ textTransform: "none", fontWeight: 700, background: ACCENT, "&:hover": { background: "#16A34A" } }}
      >
        {saving ? "Saving..." : "Save Configuration"}
      </Button>
    </Box>
  );

  const renderStep = () => {
    if (activeStep === 0) return renderMarketsStep();
    return renderReviewStep();
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 800, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <InsightsOutlinedIcon sx={{ color: ACCENT, fontSize: 28 }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }}>
            Configure Prediction Challenges
          </Typography>
          <Typography sx={{ color: "#71727A", fontSize: 13 }}>
            Author prediction markets attendees can bet on for points, resolved after the outcome is known.
          </Typography>
        </Box>
      </Box>

      {/* Step indicator */}
      <Box sx={{ display: "flex", gap: 1, mb: 3, flexWrap: "wrap" }}>
        {STEPS.map((label, i) => (
          <Box
            key={label}
            onClick={() => setActiveStep(i)}
            sx={{
              px: 2,
              py: 1,
              borderRadius: 2,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              color: activeStep === i ? "#fff" : "#6B7280",
              background: activeStep === i ? ACCENT : "#F3F4F6",
            }}
          >
            {i + 1}. {label}
          </Box>
        ))}
      </Box>

      {renderStep()}

      {/* Navigation */}
      <Box sx={{ display: "flex", justifyContent: "space-between", mt: 4 }}>
        <Button
          onClick={() =>
            activeStep === 0
              ? navigate(`/admin/my-events/${eventId}/experiences`)
              : setActiveStep(activeStep - 1)
          }
          sx={{ textTransform: "none", color: "#6B7280" }}
        >
          {activeStep === 0 ? "Cancel" : "← Back"}
        </Button>
        {activeStep < STEPS.length - 1 && (
          <Button
            variant="contained"
            onClick={() => setActiveStep(activeStep + 1)}
            sx={{ textTransform: "none", fontWeight: 700, background: ACCENT, "&:hover": { background: "#16A34A" } }}
          >
            Next →
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default PredictionConfig;
