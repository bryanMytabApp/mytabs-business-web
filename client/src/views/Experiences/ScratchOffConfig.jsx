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
import { getInstance, updateInstance } from "../../services/experienceService";
import ThemeColorPicker from "./ThemeColorPicker";
import EngagementConfigShell from "./EngagementConfigShell";

const ACCENT = "#F47A20"; // Contests & Giveaways brand color
const DEFAULT_ACCENT = "#F47A20"; // default theme color saved when none chosen

// Config limits — mirror the plugin's validateConfig rules (Requirement 1.2–1.9).
const LIMITS = {
  MIN_TIERS: 1,
  MAX_TIERS: 50,
  MAX_LABEL: 100,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 1000000,
  MIN_PROBABILITY: 0,
  MAX_PROBABILITY: 1,
  MIN_CARDS_LIMIT: 1,
  MAX_CARDS_LIMIT: 1000,
};

const STEPS = ["Prize Pool", "Rules & Review"];

let idCounter = 0;
const uid = (prefix) => `${prefix}-${Date.now()}-${idCounter++}`;

const makeTier = () => ({
  id: uid("tier"),
  prizeLabel: "",
  prizeQuantity: 1,
  winProbability: 0.1,
});

const DEFAULT_FORM = {
  accentColor: DEFAULT_ACCENT,
  prizePool: [makeTier()],
  cardsPerAttendeeLimit: 1,
  noWinMessage: "So close! Better luck next time.",
};

/**
 * Sum the tiers' win probabilities. Non-numeric entries contribute 0 so the
 * live total stays stable while a field is mid-edit (Requirement 10.5).
 */
export function totalWinProbability(prizePool) {
  return (prizePool || []).reduce((sum, tier) => {
    const p = Number(tier.winProbability);
    return sum + (Number.isFinite(p) ? p : 0);
  }, 0);
}

/**
 * Validates the scratch-off configuration form, reproducing the backend plugin
 * rules (Requirements 1.2–1.9) into an errors map keyed by field path so each
 * control can surface its own error. Returns an object of
 * { fieldPath: message }. The plugin's validateConfig remains the server-side
 * authority.
 */
export function validateAll(form) {
  const errors = {};

  // Rule 1.2 — prize-pool count 1..50.
  const prizePool = form?.prizePool || [];
  if (prizePool.length < LIMITS.MIN_TIERS) {
    errors["prizePool"] = `At least ${LIMITS.MIN_TIERS} prize tier is required.`;
  } else if (prizePool.length > LIMITS.MAX_TIERS) {
    errors["prizePool"] = `A maximum of ${LIMITS.MAX_TIERS} prize tiers is allowed.`;
  }

  prizePool.forEach((tier, idx) => {
    // Rule 1.3 — label length 1..100.
    const label = tier.prizeLabel ?? "";
    if (label.trim().length < 1) {
      errors[`prizePool[${idx}].prizeLabel`] = "Prize label is required.";
    } else if (label.length > LIMITS.MAX_LABEL) {
      errors[`prizePool[${idx}].prizeLabel`] = `Label must be ${LIMITS.MAX_LABEL} characters or fewer.`;
    }

    // Rule 1.4 — quantity integer 1..1,000,000.
    const quantity = Number(tier.prizeQuantity);
    if (
      !Number.isInteger(quantity) ||
      quantity < LIMITS.MIN_QUANTITY ||
      quantity > LIMITS.MAX_QUANTITY
    ) {
      errors[`prizePool[${idx}].prizeQuantity`] =
        `Quantity must be a whole number between ${LIMITS.MIN_QUANTITY} and ${LIMITS.MAX_QUANTITY.toLocaleString()}.`;
    }

    // Rule 1.5 — win probability number in [0,1].
    const probability = Number(tier.winProbability);
    if (
      !Number.isFinite(probability) ||
      probability < LIMITS.MIN_PROBABILITY ||
      probability > LIMITS.MAX_PROBABILITY
    ) {
      errors[`prizePool[${idx}].winProbability`] = "Win probability must be a number between 0 and 1.";
    }
  });

  // Rule 1.7 — Σ winProbability ≤ 1.
  const total = totalWinProbability(prizePool);
  if (total > LIMITS.MAX_PROBABILITY + 1e-9) {
    errors["totalWinProbability"] =
      `The combined win probabilities (${total.toFixed(4)}) exceed 1. Reduce a tier's probability.`;
  }

  // Rule 1.8 — cards-per-attendee limit integer 1..1000.
  const cardsLimit = Number(form?.cardsPerAttendeeLimit);
  if (
    !Number.isInteger(cardsLimit) ||
    cardsLimit < LIMITS.MIN_CARDS_LIMIT ||
    cardsLimit > LIMITS.MAX_CARDS_LIMIT
  ) {
    errors["cardsPerAttendeeLimit"] =
      `Cards per attendee must be a whole number between ${LIMITS.MIN_CARDS_LIMIT} and ${LIMITS.MAX_CARDS_LIMIT}.`;
  }

  return errors;
}

/**
 * PrizeTierEditor — isolated editor for a single prize tier. Wrapped in
 * React.memo (mirroring RaffleConfig's PrizeItem) so editing one tier does not
 * re-render siblings and text fields keep focus across keystrokes.
 */
const PrizeTierEditor = memo(({ tier, idx, count, errors, onUpdate, onDelete }) => {
  const labelValue = tier.prizeLabel ?? "";

  return (
    <Box
      data-testid={`prize-tier-${idx}`}
      sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
          Prize Tier {idx + 1}
        </Typography>
        <IconButton
          size="small"
          aria-label={`Remove prize tier ${idx + 1}`}
          onClick={onDelete}
          disabled={count <= LIMITS.MIN_TIERS}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <TextField
        fullWidth
        size="small"
        label="Prize Label"
        value={labelValue}
        onChange={(e) => onUpdate({ ...tier, prizeLabel: e.target.value })}
        error={!!errors[`prizePool[${idx}].prizeLabel`]}
        helperText={errors[`prizePool[${idx}].prizeLabel`] || `${labelValue.length}/${LIMITS.MAX_LABEL}`}
        inputProps={{ maxLength: LIMITS.MAX_LABEL + 1 }}
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap" }}>
        <TextField
          size="small"
          type="number"
          label="Quantity"
          value={tier.prizeQuantity ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            onUpdate({ ...tier, prizeQuantity: raw === "" ? "" : parseInt(raw, 10) });
          }}
          error={!!errors[`prizePool[${idx}].prizeQuantity`]}
          helperText={errors[`prizePool[${idx}].prizeQuantity`] || `${LIMITS.MIN_QUANTITY}–${LIMITS.MAX_QUANTITY.toLocaleString()}`}
          inputProps={{ min: LIMITS.MIN_QUANTITY, max: LIMITS.MAX_QUANTITY, step: 1 }}
          sx={{ width: 200 }}
        />
        <TextField
          size="small"
          type="number"
          label="Win Probability"
          value={tier.winProbability ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            onUpdate({ ...tier, winProbability: raw === "" ? "" : parseFloat(raw) });
          }}
          error={!!errors[`prizePool[${idx}].winProbability`]}
          helperText={errors[`prizePool[${idx}].winProbability`] || "0 to 1 (e.g. 0.1 = 10%)"}
          inputProps={{ min: LIMITS.MIN_PROBABILITY, max: LIMITS.MAX_PROBABILITY, step: 0.01 }}
          sx={{ width: 200 }}
        />
      </Box>
    </Box>
  );
});

PrizeTierEditor.displayName = "PrizeTierEditor";

/**
 * ScratchOffConfig — organizer-facing configuration screen for a Digital
 * Scratch-Offs experience instance. Mirrors RaffleConfig/SurveyConfig's stepped
 * MUI form: an errors map keyed by field path, memoized prize-tier editors,
 * client-side validation reproducing the plugin rules, a live total-win-
 * probability readout, and a save that persists the config via updateInstance.
 */
const ScratchOffConfig = () => {
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
        if (!cancelled && cfg?.prizePool?.length) {
          setForm({
            accentColor: cfg.accentColor || DEFAULT_ACCENT,
            prizePool: cfg.prizePool.map((tier, ti) => ({
              id: tier.tierId || tier.id || `tier-${ti}`,
              prizeLabel: tier.prizeLabel ?? "",
              prizeQuantity: tier.prizeQuantity ?? 1,
              winProbability: tier.winProbability ?? 0,
            })),
            cardsPerAttendeeLimit:
              typeof cfg.cardsPerAttendeeLimit === "number" ? cfg.cardsPerAttendeeLimit : 1,
            noWinMessage: cfg.noWinMessage ?? "",
          });
        }
      } catch (err) {
        // Non-fatal: a brand-new instance has no config yet.
        console.log("ScratchOffConfig: no existing config", err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, experienceId]);

  const updateTier = (idx, updatedTier) => {
    setForm((prev) => ({
      ...prev,
      prizePool: prev.prizePool.map((t, i) => (i === idx ? updatedTier : t)),
    }));
    setSaved(false);
  };

  const addTier = () => {
    setForm((prev) =>
      prev.prizePool.length >= LIMITS.MAX_TIERS
        ? prev
        : { ...prev, prizePool: [...prev.prizePool, makeTier()] }
    );
    setSaved(false);
  };

  const removeTier = (idx) => {
    setForm((prev) =>
      prev.prizePool.length <= LIMITS.MIN_TIERS
        ? prev
        : { ...prev, prizePool: prev.prizePool.filter((_, i) => i !== idx) }
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
        prizePool: form.prizePool.map((tier) => ({
          tierId: tier.id,
          prizeLabel: tier.prizeLabel.trim(),
          prizeQuantity: Number(tier.prizeQuantity),
          winProbability: Number(tier.winProbability),
        })),
        cardsPerAttendeeLimit: Number(form.cardsPerAttendeeLimit),
        noWinMessage: (form.noWinMessage ?? "").trim(),
      };
      await updateInstance(eventId, experienceId, { config });
      setSaved(true);
      // Return to the engagements dashboard after a successful save (matches Raffle).
      navigate(`/admin/my-events/${eventId}/experiences`);
    } catch (err) {
      setSaveError(
        err.response?.data?.message || err.message || "Failed to save scratch-off configuration."
      );
    } finally {
      setSaving(false);
    }
  };

  const total = totalWinProbability(form.prizePool);
  const totalExceeds = total > LIMITS.MAX_PROBABILITY + 1e-9;

  const renderPrizePoolStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Prize Pool ({form.prizePool.length}/{LIMITS.MAX_TIERS})
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Add one tier per prize. Each tier sets how many prizes are available and the chance a card
        wins that tier.
      </Typography>

      <ThemeColorPicker
        value={form.accentColor}
        onChange={(hex) => {
          setForm((prev) => ({ ...prev, accentColor: hex }));
          setSaved(false);
        }}
        helper="Accent color used across this scratch-off's display"
      />

      {errors["prizePool"] && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {errors["prizePool"]}
        </Alert>
      )}

      {/* Live Total_Win_Probability readout (Requirement 10.5). */}
      <Box
        data-testid="total-win-probability"
        sx={{
          mb: 2,
          p: 1.5,
          borderRadius: 2,
          background: totalExceeds ? "#FEF2F2" : "#F8F9FA",
          border: `1px solid ${totalExceeds ? "#FCA5A5" : "#E5E7EB"}`,
        }}
      >
        <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
          Total win probability: {total.toFixed(4)}
        </Typography>
        {totalExceeds && (
          <Typography
            data-testid="total-win-probability-warning"
            sx={{ fontSize: 12, color: "#DC2626", mt: 0.5 }}
          >
            The combined win probabilities exceed 1. Lower a tier so the total is 1 or less.
          </Typography>
        )}
      </Box>

      {form.prizePool.map((tier, idx) => (
        <PrizeTierEditor
          key={tier.id}
          tier={tier}
          idx={idx}
          count={form.prizePool.length}
          errors={errors}
          onUpdate={(updated) => updateTier(idx, updated)}
          onDelete={() => removeTier(idx)}
        />
      ))}

      <Button
        startIcon={<AddIcon />}
        onClick={addTier}
        disabled={form.prizePool.length >= LIMITS.MAX_TIERS}
        variant="outlined"
        sx={{ textTransform: "none", borderColor: ACCENT, color: ACCENT }}
      >
        Add Prize Tier
      </Button>
    </Box>
  );

  const renderRulesStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Rules &amp; Review
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Set how many cards each attendee can scratch and the message shown when a card does not win.
      </Typography>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", mb: 2 }}>
        <TextField
          size="small"
          type="number"
          label="Cards Per Attendee"
          value={form.cardsPerAttendeeLimit ?? ""}
          onChange={(e) => {
            const raw = e.target.value;
            setForm((prev) => ({
              ...prev,
              cardsPerAttendeeLimit: raw === "" ? "" : parseInt(raw, 10),
            }));
            setSaved(false);
          }}
          error={!!errors["cardsPerAttendeeLimit"]}
          helperText={
            errors["cardsPerAttendeeLimit"] ||
            `${LIMITS.MIN_CARDS_LIMIT}–${LIMITS.MAX_CARDS_LIMIT} (default 1)`
          }
          inputProps={{ min: LIMITS.MIN_CARDS_LIMIT, max: LIMITS.MAX_CARDS_LIMIT, step: 1 }}
          sx={{ width: 220 }}
        />
      </Box>

      <TextField
        fullWidth
        size="small"
        label="No-Win Message"
        multiline
        rows={2}
        value={form.noWinMessage ?? ""}
        onChange={(e) => {
          const value = e.target.value;
          setForm((prev) => ({ ...prev, noWinMessage: value }));
          setSaved(false);
        }}
        helperText="Shown when a scratched card does not win a prize."
        sx={{ mb: 3 }}
      />

      {/* Review summary */}
      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#F8F9FA" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>
          {form.prizePool.length} prize tier{form.prizePool.length === 1 ? "" : "s"}
        </Typography>
        {form.prizePool.map((tier, idx) => (
          <Typography key={tier.id} sx={{ fontSize: 13, color: "#374151", mb: 0.5 }}>
            {idx + 1}. {tier.prizeLabel || `Tier ${idx + 1}`}{" "}
            <Typography component="span" sx={{ fontSize: 12, color: "#6B7280" }}>
              (qty {tier.prizeQuantity || 0} · p {Number(tier.winProbability) || 0})
            </Typography>
          </Typography>
        ))}
        <Typography sx={{ fontSize: 12, color: "#6B7280", mt: 1 }}>
          Total win probability: {total.toFixed(4)}
        </Typography>
      </Box>

    </Box>
  );

  const renderStep = () => {
    if (activeStep === 0) return renderPrizePoolStep();
    return renderRulesStep();
  };

  return (
    <EngagementConfigShell
      title="Configure Digital Scratch-Offs"
      subtitle="Build a tiered prize pool and set how many cards each attendee can scratch."
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

export default ScratchOffConfig;
