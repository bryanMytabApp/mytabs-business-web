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
  Switch,
  FormControlLabel,
  Alert,
  IconButton,
  Chip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import QrCode2OutlinedIcon from "@mui/icons-material/QrCode2Outlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { getInstance, updateInstance } from "../../services/experienceService";

const ACCENT = "#22C55E"; // Games & Challenges brand color

// Config limits — mirror the plugin's validateConfig rules (Requirement 1).
const LIMITS = {
  MIN_CHECKPOINTS: 2,
  MAX_CHECKPOINTS: 100,
  MIN_HINT: 1,
  MAX_HINT: 300,
  MIN_POINT_VALUE: 1,
  MAX_POINT_VALUE: 10000,
  MIN_BONUS: 1,
  MAX_BONUS: 10000,
  MIN_TIME_LIMIT: 1,
  MAX_TIME_LIMIT: 1440,
};

const HUNT_MODES = [
  { value: "sequential", label: "Sequential (find in order)" },
  { value: "free-roam", label: "Free-roam (any order)" },
];

const STEPS = ["Checkpoints", "Hunt Settings & Review"];

let idCounter = 0;
const uid = (prefix) => `${prefix}-${Date.now()}-${idCounter++}`;

const makeCheckpoint = (sequencePosition) => ({
  id: uid("cp"),
  checkpointCode: "",
  hint: "",
  pointValue: 100,
  sequencePosition,
});

const DEFAULT_FORM = {
  huntMode: "sequential",
  completionThreshold: 2,
  completionBonus: { enabled: false, amount: "" },
  timeLimit: null,
  checkpoints: [makeCheckpoint(1), makeCheckpoint(2)],
};

/**
 * Validates the treasure-hunt configuration form, reproducing the backend plugin
 * rules (Requirements 1.2–1.11) into an errors map keyed by field path (e.g.
 * `checkpoints[0].hint`, `completionThreshold`) so each control can surface its
 * own error. Returns an object of { fieldPath: message }. The plugin's
 * validateConfig remains the server-side authority.
 */
export function validateAll(form) {
  const errors = {};

  const checkpoints = form?.checkpoints || [];
  const huntMode = form?.huntMode;

  // Rule 1.2 — checkpoint count 2..100.
  if (checkpoints.length < LIMITS.MIN_CHECKPOINTS) {
    errors["checkpoints"] = `At least ${LIMITS.MIN_CHECKPOINTS} checkpoints are required.`;
  } else if (checkpoints.length > LIMITS.MAX_CHECKPOINTS) {
    errors["checkpoints"] = `A maximum of ${LIMITS.MAX_CHECKPOINTS} checkpoints is allowed.`;
  }

  // Rule 1.7 — hunt mode membership.
  if (huntMode !== "sequential" && huntMode !== "free-roam") {
    errors["huntMode"] = "Select a hunt mode.";
  }

  // Track checkpoint codes for duplicate detection (Rule 1.6).
  const seenCodes = new Map();

  checkpoints.forEach((cp, idx) => {
    // Rule 1.3 — hint length 1..300.
    const hint = cp.hint ?? "";
    if (hint.trim().length < LIMITS.MIN_HINT) {
      errors[`checkpoints[${idx}].hint`] = "A location hint is required.";
    } else if (hint.length > LIMITS.MAX_HINT) {
      errors[`checkpoints[${idx}].hint`] = `Hint must be ${LIMITS.MAX_HINT} characters or fewer.`;
    }

    // Rule 1.4 — point value integer 1..10000.
    const pointValue = Number(cp.pointValue);
    if (
      !Number.isInteger(pointValue) ||
      pointValue < LIMITS.MIN_POINT_VALUE ||
      pointValue > LIMITS.MAX_POINT_VALUE
    ) {
      errors[`checkpoints[${idx}].pointValue`] = `Point value must be an integer between ${LIMITS.MIN_POINT_VALUE} and ${LIMITS.MAX_POINT_VALUE}.`;
    }

    // Rule 1.5 — checkpoint code is a non-empty string (populated by the QR system).
    const code = (cp.checkpointCode ?? "").trim();
    if (code.length < 1) {
      errors[`checkpoints[${idx}].checkpointCode`] = "Associate a QR checkpoint code for this checkpoint.";
    } else {
      // Rule 1.6 — duplicate checkpoint codes flagged at the offending checkpoint.
      if (seenCodes.has(code)) {
        errors[`checkpoints[${idx}].checkpointCode`] = `Duplicate checkpoint code: ${code}.`;
      } else {
        seenCodes.set(code, idx);
      }
    }
  });

  // Rule 1.8 — sequential mode: sequencePosition values are a contiguous
  // permutation of 1..N.
  if (huntMode === "sequential" && checkpoints.length > 0) {
    const positions = checkpoints.map((cp) => Number(cp.sequencePosition));
    const expected = new Set();
    for (let i = 1; i <= checkpoints.length; i += 1) expected.add(i);
    const seenPositions = new Set();
    let permutationValid = true;
    positions.forEach((pos) => {
      if (!Number.isInteger(pos) || !expected.has(pos) || seenPositions.has(pos)) {
        permutationValid = false;
      }
      seenPositions.add(pos);
    });
    if (!permutationValid) {
      errors["sequencePosition"] = `In sequential mode, checkpoint positions must be a contiguous set of 1 to ${checkpoints.length}.`;
      // Also surface at the offending checkpoint controls.
      checkpoints.forEach((cp, idx) => {
        const pos = Number(cp.sequencePosition);
        if (!Number.isInteger(pos) || pos < 1 || pos > checkpoints.length) {
          errors[`checkpoints[${idx}].sequencePosition`] = `Position must be between 1 and ${checkpoints.length}.`;
        }
      });
    }
  }

  // Rule 1.9 — completion threshold integer in [1, #checkpoints].
  const threshold = Number(form?.completionThreshold);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > checkpoints.length) {
    errors["completionThreshold"] = `Completion threshold must be an integer between 1 and ${checkpoints.length}.`;
  }

  // Rule 1.10 — when the completion bonus is enabled, amount integer 1..10000.
  const bonus = form?.completionBonus || {};
  if (bonus.enabled) {
    const amount = Number(bonus.amount);
    if (!Number.isInteger(amount) || amount < LIMITS.MIN_BONUS || amount > LIMITS.MAX_BONUS) {
      errors["completionBonus.amount"] = `Completion bonus must be an integer between ${LIMITS.MIN_BONUS} and ${LIMITS.MAX_BONUS}.`;
    }
  }

  // Rule 1.11 — when present, time limit integer 1..1440 minutes.
  if (form?.timeLimit !== null && form?.timeLimit !== undefined && form?.timeLimit !== "") {
    const tl = Number(form.timeLimit);
    if (!Number.isInteger(tl) || tl < LIMITS.MIN_TIME_LIMIT || tl > LIMITS.MAX_TIME_LIMIT) {
      errors["timeLimit"] = `Time limit must be an integer between ${LIMITS.MIN_TIME_LIMIT} and ${LIMITS.MAX_TIME_LIMIT} minutes.`;
    }
  }

  return errors;
}

/**
 * QrAssociationControl — a read-only display of the QR-system-supplied checkpoint
 * code plus an "Associate QR code" button. The code value is NEVER free-typed by
 * the organizer: it is minted and resolved by the QR Code System (Requirements
 * 2.1, 2.2). This control requests/associates a code and stores the returned
 * Checkpoint_Code on the checkpoint. Here we simulate the QR system handing back
 * an opaque code string (the real integration replaces `associateCode` with a
 * QR-system call).
 */
const QrAssociationControl = memo(({ checkpoint, idx, error, onAssociate }) => {
  const code = checkpoint.checkpointCode ?? "";
  return (
    <Box>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#374151", mb: 0.5 }}>
        QR Checkpoint Code
      </Typography>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        {code ? (
          <Chip
            icon={<CheckCircleOutlineIcon />}
            label={code}
            data-testid={`checkpoint-code-${idx}`}
            sx={{ background: "#E8F5E9", color: "#2E7D32", fontWeight: 700, fontFamily: "monospace" }}
          />
        ) : (
          <Typography sx={{ fontSize: 12, color: "#9CA3AF" }} data-testid={`checkpoint-code-empty-${idx}`}>
            No code associated
          </Typography>
        )}
        <Button
          size="small"
          variant="outlined"
          startIcon={<QrCode2OutlinedIcon />}
          onClick={onAssociate}
          aria-label={`Associate QR code for checkpoint ${idx + 1}`}
          sx={{ textTransform: "none", borderColor: ACCENT, color: ACCENT }}
        >
          {code ? "Re-associate QR code" : "Associate QR code"}
        </Button>
      </Box>
      {error && (
        <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
});

QrAssociationControl.displayName = "QrAssociationControl";

/**
 * CheckpointEditor — isolated editor for a single checkpoint. Wrapped in
 * React.memo (like Check-In's PointEditor / Raffles' PrizeItem) so editing one
 * checkpoint does not re-render siblings and text fields keep focus across
 * keystrokes. The checkpoint code is associated via the QR system, never
 * free-typed (Requirement 10.2). When the hunt mode is `sequential` the
 * sequence-position control is shown; reorder (move up/down) controls renumber
 * positions contiguously (Requirement 10.6).
 */
const CheckpointEditor = memo(
  ({ checkpoint, idx, count, sequential, errors, onUpdate, onDelete, onAssociate, onMoveUp, onMoveDown }) => {
    const hintValue = checkpoint.hint ?? "";

    const updateNumber = (key, raw) => {
      const value = raw === "" ? "" : parseInt(raw, 10);
      onUpdate({ ...checkpoint, [key]: value });
    };

    return (
      <Box
        data-testid={`checkpoint-editor-${idx}`}
        sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
            Checkpoint {idx + 1}
          </Typography>
          <Box>
            {sequential && (
              <>
                <IconButton
                  size="small"
                  aria-label={`Move checkpoint ${idx + 1} up`}
                  onClick={onMoveUp}
                  disabled={idx === 0}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  aria-label={`Move checkpoint ${idx + 1} down`}
                  onClick={onMoveDown}
                  disabled={idx === count - 1}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </>
            )}
            <IconButton
              size="small"
              aria-label={`Remove checkpoint ${idx + 1}`}
              onClick={onDelete}
              disabled={count <= LIMITS.MIN_CHECKPOINTS}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        <TextField
          fullWidth
          size="small"
          label="Location Hint"
          value={hintValue}
          onChange={(e) => onUpdate({ ...checkpoint, hint: e.target.value })}
          error={!!errors[`checkpoints[${idx}].hint`]}
          helperText={errors[`checkpoints[${idx}].hint`] || `${hintValue.length}/${LIMITS.MAX_HINT}`}
          inputProps={{ maxLength: LIMITS.MAX_HINT + 1 }}
          sx={{ mb: 2 }}
        />

        <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap", alignItems: "flex-start" }}>
          <TextField
            size="small"
            type="number"
            label="Point Value"
            value={checkpoint.pointValue ?? ""}
            onChange={(e) => updateNumber("pointValue", e.target.value)}
            error={!!errors[`checkpoints[${idx}].pointValue`]}
            helperText={
              errors[`checkpoints[${idx}].pointValue`] ||
              `${LIMITS.MIN_POINT_VALUE}–${LIMITS.MAX_POINT_VALUE}`
            }
            inputProps={{ min: LIMITS.MIN_POINT_VALUE, max: LIMITS.MAX_POINT_VALUE }}
            sx={{ width: 160 }}
          />
          {sequential && (
            <TextField
              size="small"
              type="number"
              label="Sequence Position"
              value={checkpoint.sequencePosition ?? ""}
              onChange={(e) => updateNumber("sequencePosition", e.target.value)}
              error={!!errors[`checkpoints[${idx}].sequencePosition`]}
              helperText={errors[`checkpoints[${idx}].sequencePosition`] || `Order (1–${count})`}
              inputProps={{ min: 1, max: count, "aria-label": `Sequence position for checkpoint ${idx + 1}` }}
              sx={{ width: 160 }}
            />
          )}
          <Box sx={{ flex: 1, minWidth: 220 }}>
            <QrAssociationControl
              checkpoint={checkpoint}
              idx={idx}
              error={errors[`checkpoints[${idx}].checkpointCode`]}
              onAssociate={onAssociate}
            />
          </Box>
        </Box>
      </Box>
    );
  }
);

CheckpointEditor.displayName = "CheckpointEditor";

/**
 * TreasureHuntConfig — organizer-facing configuration screen for a Treasure Hunts
 * experience instance. Mirrors CheckInChallengeConfig/RaffleConfig's stepped MUI
 * form: memoized checkpoint editors preserving input focus, an errors map keyed by
 * field path, client-side validation reproducing the plugin rules, a QR
 * association control whose code is minted by the QR Code System (never
 * free-typed), and a save that persists the config via updateInstance.
 */
const TreasureHuntConfig = () => {
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
        if (!cancelled && cfg?.checkpoints?.length) {
          setForm({
            huntMode: cfg.huntMode || "sequential",
            completionThreshold: cfg.completionThreshold ?? cfg.checkpoints.length,
            completionBonus: {
              enabled: !!cfg.completionBonus?.enabled,
              amount: cfg.completionBonus?.amount ?? "",
            },
            timeLimit: cfg.timeLimit ?? null,
            checkpoints: cfg.checkpoints.map((cp, ci) => ({
              id: cp.id || `cp-${ci}`,
              checkpointCode: cp.checkpointCode ?? "",
              hint: cp.hint ?? "",
              pointValue: cp.pointValue ?? 100,
              sequencePosition: cp.sequencePosition ?? ci + 1,
            })),
          });
        }
      } catch (err) {
        // Non-fatal: a brand-new instance has no config yet.
        console.log("TreasureHuntConfig: no existing config", err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, experienceId]);

  const sequential = form.huntMode === "sequential";

  // Renumber sequencePosition contiguously 1..N in array order (Requirement 10.6).
  const renumber = (checkpoints) =>
    checkpoints.map((cp, i) => ({ ...cp, sequencePosition: i + 1 }));

  // ── Checkpoint mutations ──────────────────────────────────────────────────
  const updateCheckpoint = (idx, updated) => {
    setForm((prev) => ({
      ...prev,
      checkpoints: prev.checkpoints.map((c, i) => (i === idx ? updated : c)),
    }));
    setSaved(false);
  };

  const addCheckpoint = () => {
    setForm((prev) =>
      prev.checkpoints.length >= LIMITS.MAX_CHECKPOINTS
        ? prev
        : {
            ...prev,
            checkpoints: renumber([...prev.checkpoints, makeCheckpoint(prev.checkpoints.length + 1)]),
          }
    );
    setSaved(false);
  };

  const removeCheckpoint = (idx) => {
    setForm((prev) => {
      if (prev.checkpoints.length <= LIMITS.MIN_CHECKPOINTS) return prev;
      const remaining = prev.checkpoints.filter((_, i) => i !== idx);
      const nextThreshold =
        Number(prev.completionThreshold) > remaining.length
          ? remaining.length
          : prev.completionThreshold;
      return {
        ...prev,
        checkpoints: renumber(remaining),
        completionThreshold: nextThreshold,
      };
    });
    setSaved(false);
  };

  const moveCheckpoint = (idx, delta) => {
    setForm((prev) => {
      const target = idx + delta;
      if (target < 0 || target >= prev.checkpoints.length) return prev;
      const next = [...prev.checkpoints];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return { ...prev, checkpoints: renumber(next) };
    });
    setSaved(false);
  };

  // Associate a QR checkpoint code. The value is supplied by the QR Code System
  // (Requirements 2.1, 2.2) — here we simulate the QR system minting an opaque,
  // unique code string. It is never free-typed by the organizer.
  const associateCode = (idx) => {
    setForm((prev) => {
      const code = `EVT-${(experienceId || "EXP").slice(-4).toUpperCase()}-CP-${uid("").slice(-6).toUpperCase()}`;
      return {
        ...prev,
        checkpoints: prev.checkpoints.map((c, i) =>
          i === idx ? { ...c, checkpointCode: code } : c
        ),
      };
    });
    setSaved(false);
  };

  // ── Hunt-settings mutations ───────────────────────────────────────────────
  const setHuntMode = (mode) => {
    setForm((prev) => ({ ...prev, huntMode: mode }));
    setSaved(false);
  };

  const setCompletionThreshold = (raw) => {
    setForm((prev) => ({
      ...prev,
      completionThreshold: raw === "" ? "" : parseInt(raw, 10),
    }));
    setSaved(false);
  };

  const setBonusEnabled = (enabled) => {
    setForm((prev) => ({
      ...prev,
      completionBonus: { ...prev.completionBonus, enabled },
    }));
    setSaved(false);
  };

  const setBonusAmount = (raw) => {
    setForm((prev) => ({
      ...prev,
      completionBonus: {
        ...prev.completionBonus,
        amount: raw === "" ? "" : parseInt(raw, 10),
      },
    }));
    setSaved(false);
  };

  const setTimeLimitEnabled = (enabled) => {
    setForm((prev) => ({ ...prev, timeLimit: enabled ? 60 : null }));
    setSaved(false);
  };

  const setTimeLimit = (raw) => {
    setForm((prev) => ({ ...prev, timeLimit: raw === "" ? "" : parseInt(raw, 10) }));
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
        huntMode: form.huntMode,
        completionThreshold: Number(form.completionThreshold),
        completionBonus: form.completionBonus.enabled
          ? { enabled: true, amount: Number(form.completionBonus.amount) }
          : { enabled: false },
        checkpoints: form.checkpoints.map((cp) => ({
          id: cp.id,
          checkpointCode: (cp.checkpointCode || "").trim(),
          hint: cp.hint.trim(),
          pointValue: Number(cp.pointValue),
          sequencePosition: Number(cp.sequencePosition),
        })),
      };
      if (form.timeLimit !== null && form.timeLimit !== undefined && form.timeLimit !== "") {
        config.timeLimit = Number(form.timeLimit);
      }
      await updateInstance(eventId, experienceId, { config });
      setSaved(true);
    } catch (err) {
      setSaveError(
        err.response?.data?.message || err.message || "Failed to save treasure hunt configuration."
      );
    } finally {
      setSaving(false);
    }
  };

  const renderCheckpointsStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Checkpoints ({form.checkpoints.length}/{LIMITS.MAX_CHECKPOINTS})
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Define each physical checkpoint attendees will find. Associate a QR code, write a location hint, and set a point value. In sequential mode, set the order attendees must find them.
      </Typography>

      {errors["checkpoints"] && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {errors["checkpoints"]}
        </Alert>
      )}
      {errors["sequencePosition"] && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {errors["sequencePosition"]}
        </Alert>
      )}

      {form.checkpoints.map((checkpoint, idx) => (
        <CheckpointEditor
          key={checkpoint.id}
          checkpoint={checkpoint}
          idx={idx}
          count={form.checkpoints.length}
          sequential={sequential}
          errors={errors}
          onUpdate={(updated) => updateCheckpoint(idx, updated)}
          onDelete={() => removeCheckpoint(idx)}
          onAssociate={() => associateCode(idx)}
          onMoveUp={() => moveCheckpoint(idx, -1)}
          onMoveDown={() => moveCheckpoint(idx, 1)}
        />
      ))}

      <Button
        startIcon={<AddIcon />}
        onClick={addCheckpoint}
        disabled={form.checkpoints.length >= LIMITS.MAX_CHECKPOINTS}
        variant="outlined"
        sx={{ textTransform: "none", borderColor: ACCENT, color: ACCENT }}
      >
        Add Checkpoint
      </Button>
    </Box>
  );

  const renderSettingsStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Hunt Settings & Review
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Choose how the hunt runs, when attendees are marked complete, the optional completion bonus and time limit, then save the configuration to this experience.
      </Typography>

      {/* Hunt mode (Requirement 10.3). */}
      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}>
        <FormControl size="small" sx={{ minWidth: 260 }} error={!!errors["huntMode"]}>
          <InputLabel id="hunt-mode-label">Hunt Mode</InputLabel>
          <Select
            labelId="hunt-mode-label"
            label="Hunt Mode"
            value={form.huntMode}
            onChange={(e) => setHuntMode(e.target.value)}
            inputProps={{ "aria-label": "Hunt mode" }}
          >
            {HUNT_MODES.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {errors["huntMode"] && (
          <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
            {errors["huntMode"]}
          </Typography>
        )}
      </Box>

      {/* Completion threshold (Requirement 10.3). */}
      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}>
        <TextField
          size="small"
          type="number"
          label="Completion Threshold"
          value={form.completionThreshold ?? ""}
          onChange={(e) => setCompletionThreshold(e.target.value)}
          error={!!errors["completionThreshold"]}
          helperText={
            errors["completionThreshold"] ||
            `Checkpoints needed to complete the hunt (1–${form.checkpoints.length})`
          }
          inputProps={{ min: 1, max: form.checkpoints.length, "aria-label": "Completion threshold" }}
          sx={{ width: 320 }}
        />
      </Box>

      {/* Completion bonus (Requirement 10.3). */}
      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}>
        <FormControlLabel
          control={
            <Switch
              checked={!!form.completionBonus.enabled}
              onChange={(e) => setBonusEnabled(e.target.checked)}
              inputProps={{ "aria-label": "Enable completion bonus" }}
              sx={{ "& .Mui-checked": { color: ACCENT } }}
            />
          }
          label={
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Completion Bonus</Typography>
              <Typography sx={{ fontSize: 12, color: "#6B7280" }}>
                Award bonus points to attendees who complete the hunt.
              </Typography>
            </Box>
          }
        />
        {form.completionBonus.enabled && (
          <TextField
            size="small"
            type="number"
            label="Bonus Points"
            value={form.completionBonus.amount ?? ""}
            onChange={(e) => setBonusAmount(e.target.value)}
            error={!!errors["completionBonus.amount"]}
            helperText={
              errors["completionBonus.amount"] || `${LIMITS.MIN_BONUS}–${LIMITS.MAX_BONUS}`
            }
            inputProps={{ min: LIMITS.MIN_BONUS, max: LIMITS.MAX_BONUS, "aria-label": "Completion bonus amount" }}
            sx={{ width: 260, mt: 1.5, display: "block" }}
          />
        )}
      </Box>

      {/* Optional time limit (Requirement 10.3). */}
      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}>
        <FormControlLabel
          control={
            <Switch
              checked={form.timeLimit !== null && form.timeLimit !== undefined}
              onChange={(e) => setTimeLimitEnabled(e.target.checked)}
              inputProps={{ "aria-label": "Enable time limit" }}
              sx={{ "& .Mui-checked": { color: ACCENT } }}
            />
          }
          label={
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Time Limit</Typography>
              <Typography sx={{ fontSize: 12, color: "#6B7280" }}>
                Close the hunt a set number of minutes after it goes live.
              </Typography>
            </Box>
          }
        />
        {form.timeLimit !== null && form.timeLimit !== undefined && (
          <TextField
            size="small"
            type="number"
            label="Time Limit (minutes)"
            value={form.timeLimit ?? ""}
            onChange={(e) => setTimeLimit(e.target.value)}
            error={!!errors["timeLimit"]}
            helperText={
              errors["timeLimit"] || `${LIMITS.MIN_TIME_LIMIT}–${LIMITS.MAX_TIME_LIMIT} minutes`
            }
            inputProps={{ min: LIMITS.MIN_TIME_LIMIT, max: LIMITS.MAX_TIME_LIMIT, "aria-label": "Time limit minutes" }}
            sx={{ width: 260, mt: 1.5, display: "block" }}
          />
        )}
      </Box>

      {/* Review summary. */}
      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#F8F9FA" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>
          {form.checkpoints.length} checkpoint{form.checkpoints.length === 1 ? "" : "s"} ·{" "}
          {form.huntMode === "sequential" ? "Sequential" : "Free-roam"}
        </Typography>
        {form.checkpoints.map((cp, idx) => (
          <Typography key={cp.id} sx={{ fontSize: 13, color: "#374151" }}>
            {sequential ? `${cp.sequencePosition}.` : `${idx + 1}.`}{" "}
            {cp.hint || `Checkpoint ${idx + 1}`}{" "}
            <Typography component="span" sx={{ fontSize: 12, color: "#6B7280" }}>
              ({cp.pointValue} pts)
            </Typography>
          </Typography>
        ))}
      </Box>

      {saveError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {saveError}
        </Alert>
      )}
      {saved && (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
          Treasure hunt configuration saved.
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
    if (activeStep === 0) return renderCheckpointsStep();
    return renderSettingsStep();
  };

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 800, mx: "auto" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <PlaceOutlinedIcon sx={{ color: ACCENT, fontSize: 28 }} />
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }}>
            Configure Treasure Hunt
          </Typography>
          <Typography sx={{ color: "#71727A", fontSize: 13 }}>
            Create a location-based scavenger hunt using QR codes placed around your venue.
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

export default TreasureHuntConfig;
