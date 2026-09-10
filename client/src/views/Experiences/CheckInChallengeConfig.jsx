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
import QrCode2OutlinedIcon from "@mui/icons-material/QrCode2Outlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import { getInstance, updateInstance } from "../../services/experienceService";

const ACCENT = "#22C55E"; // Games & Challenges brand color

// Config limits — mirror the plugin's validateConfig rules (Requirements 1 & 2).
const LIMITS = {
  MIN_POINTS: 1,
  MAX_POINTS: 200,
  MAX_LABEL: 200,
  MIN_POINT_VALUE: 1,
  MAX_POINT_VALUE: 10000,
  MIN_MILESTONES: 0,
  MAX_MILESTONES: 20,
  MAX_REWARD_LABEL: 200,
  MIN_REWARD_POINTS: 0,
  MAX_REWARD_POINTS: 10000,
};

const MILESTONE_TYPES = [
  { value: "threshold", label: "Check-in threshold" },
  { value: "required-set", label: "Required set of points" },
];

const STEPS = ["Check-In Points", "Milestone Rewards", "Settings & Review"];

/**
 * Page chrome styling, mirrored from RaffleConfig's ECN_STYLES so the Check-In
 * Challenge configuration screen matches the raffle pages: a soft blue gradient
 * wrapper, a frosted glassmorphism stepper with pill steps, a white content
 * card, and a sticky footer with pill-shaped nav buttons. The raffle's orange
 * accent is swapped for the Games & Challenges green (ACCENT) so this page keeps
 * its own brand color while adopting the raffle look.
 */
const CIC_STYLES = `
.cic-wrap{min-height:100vh;background:linear-gradient(135deg,#e8f4fd 0%,#dbeeff 35%,#f0f8ff 65%,#e2eeff 100%);padding:24px;font-family:'Nunito',sans-serif;color:#2d3748;overflow-x:hidden}
.cic-wrap .MuiOutlinedInput-root{background:#fff}
.cic-wrap .MuiInputLabel-shrink{background:#fff;padding:0 6px}
.cic-pg-h{font-size:22px;font-weight:700;color:${ACCENT};margin-bottom:5px;font-family:'Outfit','Nunito',sans-serif}
.cic-pg-s{font-size:13px;color:#6B7280;margin-bottom:24px;line-height:1.5}
.cic-steps{display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.75);backdrop-filter:blur(18px) saturate(1.4);border:1.5px solid rgba(200,220,240,0.6);box-shadow:0 4px 20px rgba(0,100,180,0.06);border-radius:14px;padding:14px 18px;width:100%;flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
.cic-steps::-webkit-scrollbar{display:none}
.cic-step-btn{padding:8px 14px;border:none;border-radius:9px;font-size:12px;font-weight:500;color:#5a738a;cursor:default;transition:all 0.22s;font-family:'Nunito',sans-serif;background:none;white-space:nowrap}
.cic-step-btn.cur{background:${ACCENT};color:#fff;font-weight:700;box-shadow:0 2px 8px rgba(34,197,94,0.25)}
.cic-step-btn.done{color:#1ab76b;font-weight:600}
.cic-card{background:#FFFFFF;border-radius:16px;padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.06);margin-bottom:16px}
.cic-foot{position:sticky;bottom:0;background:rgba(255,255,255,.92);backdrop-filter:blur(16px);border-top:1px solid #E5E7EB;padding:13px 24px;display:flex;justify-content:space-between;align-items:center;box-shadow:0 -2px 12px rgba(0,0,0,.04);border-radius:0 0 16px 16px;margin-top:20px}
.cic-bn{background:${ACCENT};color:#fff;border:none;border-radius:12px;padding:12px 34px;font-size:14.5px;font-weight:800;font-family:'Nunito',sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:8px;box-shadow:0 4px 16px rgba(34,197,94,.33);transition:all .2s cubic-bezier(.4,0,.2,1)}
.cic-bn:hover{background:#16A34A;transform:translateY(-1px);box-shadow:0 6px 20px rgba(34,197,94,.40)}
.cic-bn:disabled{opacity:.45;cursor:not-allowed;transform:none}
.cic-bb{background:rgba(255,255,255,.80);color:#2d3748;border:1.5px solid rgba(0,0,0,.09);border-radius:10px;padding:8px 17px;font-size:13px;font-weight:700;font-family:'Nunito',sans-serif;cursor:pointer;display:inline-flex;align-items:center;gap:6px;transition:all .2s cubic-bezier(.4,0,.2,1)}
.cic-bb:hover{background:#fff}
.cic-bb:disabled{opacity:.45;cursor:not-allowed}
`;

let idCounter = 0;
const uid = (prefix) => `${prefix}-${Date.now()}-${idCounter++}`;

const makePoint = () => ({
  id: uid("pt"),
  label: "",
  checkInCode: "",
  pointValue: 100,
  timeWindow: null,
});

const makeMilestone = () => ({
  id: uid("ms"),
  type: "threshold",
  rewardLabel: "",
  rewardPoints: "",
  thresholdCount: 1,
  requiredSet: [],
});

const DEFAULT_FORM = {
  checkInPoints: [makePoint()],
  milestoneRewards: [],
  leaderboardEnabled: true,
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
 * Validates the check-in challenge configuration form, reproducing the backend
 * plugin rules (Requirements 1.2–1.7 and 2.1–2.7) into an errors map keyed by
 * field path (e.g. `checkInPoints[0].pointValue`, `milestoneRewards[1].requiredSet`)
 * so each control can surface its own error. Returns an object of
 * { fieldPath: message }. The plugin's validateConfig remains the server-side
 * authority.
 */
export function validateAll(form) {
  const errors = {};

  const points = form?.checkInPoints || [];
  const milestones = form?.milestoneRewards || [];

  // Rule 1.2 — check-in point count 1..200.
  if (points.length < LIMITS.MIN_POINTS) {
    errors["checkInPoints"] = `At least ${LIMITS.MIN_POINTS} check-in point is required.`;
  } else if (points.length > LIMITS.MAX_POINTS) {
    errors["checkInPoints"] = `A maximum of ${LIMITS.MAX_POINTS} check-in points is allowed.`;
  }

  // Track check-in codes for duplicate detection (Rule 1.6).
  const seenCodes = new Map();

  points.forEach((pt, idx) => {
    // Rule 1.3 — label length 1..200.
    const label = pt.label ?? "";
    if (label.trim().length < 1) {
      errors[`checkInPoints[${idx}].label`] = "Point label is required.";
    } else if (label.length > LIMITS.MAX_LABEL) {
      errors[`checkInPoints[${idx}].label`] = `Label must be ${LIMITS.MAX_LABEL} characters or fewer.`;
    }

    // Rule 1.4 — point value integer 1..10000.
    const pointValue = Number(pt.pointValue);
    if (
      !Number.isInteger(pointValue) ||
      pointValue < LIMITS.MIN_POINT_VALUE ||
      pointValue > LIMITS.MAX_POINT_VALUE
    ) {
      errors[`checkInPoints[${idx}].pointValue`] = `Point value must be an integer between ${LIMITS.MIN_POINT_VALUE} and ${LIMITS.MAX_POINT_VALUE}.`;
    }

    // Rule 1.5 — check-in code is a non-empty string (populated by the QR system).
    const code = (pt.checkInCode ?? "").trim();
    if (code.length < 1) {
      errors[`checkInPoints[${idx}].checkInCode`] = "Associate a QR check-in code for this point.";
    } else {
      // Rule 1.6 — duplicate check-in codes flagged at the offending point.
      if (seenCodes.has(code)) {
        errors[`checkInPoints[${idx}].checkInCode`] = `Duplicate check-in code: ${code}.`;
      } else {
        seenCodes.set(code, idx);
      }
    }

    // Rule 1.7 — when present, time-window start strictly before end.
    const tw = pt.timeWindow;
    if (tw && (tw.start || tw.end)) {
      const startMs = tw.start ? new Date(tw.start).getTime() : NaN;
      const endMs = tw.end ? new Date(tw.end).getTime() : NaN;
      if (!tw.start || Number.isNaN(startMs)) {
        errors[`checkInPoints[${idx}].timeWindow.start`] = "A start time is required for the time window.";
      }
      if (!tw.end || Number.isNaN(endMs)) {
        errors[`checkInPoints[${idx}].timeWindow.end`] = "An end time is required for the time window.";
      }
      if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && startMs >= endMs) {
        errors[`checkInPoints[${idx}].timeWindow.end`] = "End time must be after the start time.";
      }
    }
  });

  // Rule 2.1 — milestone count 0..20.
  if (milestones.length > LIMITS.MAX_MILESTONES) {
    errors["milestoneRewards"] = `A maximum of ${LIMITS.MAX_MILESTONES} milestone rewards is allowed.`;
  }

  const pointIds = new Set(points.map((p) => p.id));

  milestones.forEach((ms, idx) => {
    // Rule 2.2 — type membership.
    if (ms.type !== "threshold" && ms.type !== "required-set") {
      errors[`milestoneRewards[${idx}].type`] = "Select a milestone type.";
    }

    // Rule 2.3 — reward label length 1..200.
    const rewardLabel = ms.rewardLabel ?? "";
    if (rewardLabel.trim().length < 1) {
      errors[`milestoneRewards[${idx}].rewardLabel`] = "Reward label is required.";
    } else if (rewardLabel.length > LIMITS.MAX_REWARD_LABEL) {
      errors[`milestoneRewards[${idx}].rewardLabel`] = `Reward label must be ${LIMITS.MAX_REWARD_LABEL} characters or fewer.`;
    }

    // Rule 2.4 — when present, reward points integer 0..10000.
    if (ms.rewardPoints !== "" && ms.rewardPoints !== null && ms.rewardPoints !== undefined) {
      const rp = Number(ms.rewardPoints);
      if (!Number.isInteger(rp) || rp < LIMITS.MIN_REWARD_POINTS || rp > LIMITS.MAX_REWARD_POINTS) {
        errors[`milestoneRewards[${idx}].rewardPoints`] = `Reward points must be an integer between ${LIMITS.MIN_REWARD_POINTS} and ${LIMITS.MAX_REWARD_POINTS}.`;
      }
    }

    if (ms.type === "threshold") {
      // Rule 2.5 — threshold count integer in [1, #points].
      const tc = Number(ms.thresholdCount);
      if (!Number.isInteger(tc) || tc < 1 || tc > points.length) {
        errors[`milestoneRewards[${idx}].thresholdCount`] = `Threshold must be an integer between 1 and ${points.length}.`;
      }
    } else if (ms.type === "required-set") {
      // Rule 2.6 — non-empty required set referencing defined points.
      const set = ms.requiredSet || [];
      if (set.length < 1) {
        errors[`milestoneRewards[${idx}].requiredSet`] = "Select at least one check-in point.";
      } else {
        // Rule 2.7 — every id must reference a defined check-in point.
        const unknown = set.find((id) => !pointIds.has(id));
        if (unknown) {
          errors[`milestoneRewards[${idx}].requiredSet`] = `Unknown check-in point: ${unknown}.`;
        }
      }
    }
  });

  return errors;
}

/**
 * QrAssociationControl — a read-only display of the QR-system-supplied
 * check-in code plus an "Associate QR code" button. The code value is NEVER
 * free-typed by the organizer: it is minted and resolved by the QR Code System
 * (Requirements 3.1, 3.2). This control requests/associates a code and stores
 * the returned Check_In_Code on the point. Here we simulate the QR system
 * handing back an opaque code string (the real integration replaces
 * `associateCode` with a QR-system call).
 */
const QrAssociationControl = memo(({ point, idx, error, onAssociate }) => {
  const code = point.checkInCode ?? "";
  return (
    <Box>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#374151", mb: 0.5 }}>
        QR Check-In Code
      </Typography>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
        {code ? (
          <Chip
            icon={<CheckCircleOutlineIcon />}
            label={code}
            data-testid={`checkin-code-${idx}`}
            sx={{ background: "#E8F5E9", color: "#2E7D32", fontWeight: 700, fontFamily: "monospace" }}
          />
        ) : (
          <Typography sx={{ fontSize: 12, color: "#9CA3AF" }} data-testid={`checkin-code-empty-${idx}`}>
            No code associated
          </Typography>
        )}
        <Button
          size="small"
          variant="outlined"
          startIcon={<QrCode2OutlinedIcon />}
          onClick={onAssociate}
          aria-label={`Associate QR code for check-in point ${idx + 1}`}
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
 * PointEditor — isolated editor for a single check-in point. Wrapped in
 * React.memo (like PredictionConfig's MarketEditor / Raffles' PrizeItem) so
 * editing one point does not re-render siblings and text fields keep focus
 * across keystrokes. The check-in code is associated via the QR system, never
 * free-typed (Requirement 11.2).
 */
const PointEditor = memo(({ point, idx, count, errors, onUpdate, onDelete, onAssociate }) => {
  const labelValue = point.label ?? "";
  const hasWindow = !!point.timeWindow;

  const updateNumber = (key, raw) => {
    const value = raw === "" ? "" : parseInt(raw, 10);
    onUpdate({ ...point, [key]: value });
  };

  const toggleWindow = (enabled) => {
    onUpdate({ ...point, timeWindow: enabled ? { start: "", end: "" } : null });
  };

  const updateWindow = (key, iso) => {
    onUpdate({ ...point, timeWindow: { ...(point.timeWindow || { start: "", end: "" }), [key]: iso } });
  };

  return (
    <Box
      data-testid={`point-editor-${idx}`}
      sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
          Check-In Point {idx + 1}
        </Typography>
        <IconButton
          size="small"
          aria-label={`Remove check-in point ${idx + 1}`}
          onClick={onDelete}
          disabled={count <= LIMITS.MIN_POINTS}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <TextField
        fullWidth
        size="small"
        label="Point Label"
        value={labelValue}
        onChange={(e) => onUpdate({ ...point, label: e.target.value })}
        error={!!errors[`checkInPoints[${idx}].label`]}
        helperText={errors[`checkInPoints[${idx}].label`] || `${labelValue.length}/${LIMITS.MAX_LABEL}`}
        inputProps={{ maxLength: LIMITS.MAX_LABEL + 1 }}
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap", alignItems: "flex-start" }}>
        <TextField
          size="small"
          type="number"
          label="Point Value"
          value={point.pointValue ?? ""}
          onChange={(e) => updateNumber("pointValue", e.target.value)}
          error={!!errors[`checkInPoints[${idx}].pointValue`]}
          helperText={
            errors[`checkInPoints[${idx}].pointValue`] ||
            `${LIMITS.MIN_POINT_VALUE}–${LIMITS.MAX_POINT_VALUE}`
          }
          inputProps={{ min: LIMITS.MIN_POINT_VALUE, max: LIMITS.MAX_POINT_VALUE }}
          sx={{ width: 160 }}
        />
        <Box sx={{ flex: 1, minWidth: 220 }}>
          <QrAssociationControl
            point={point}
            idx={idx}
            error={errors[`checkInPoints[${idx}].checkInCode`]}
            onAssociate={onAssociate}
          />
        </Box>
      </Box>

      {/* Optional time window (Requirement 11.2). */}
      <FormControlLabel
        control={
          <Switch
            checked={hasWindow}
            onChange={(e) => toggleWindow(e.target.checked)}
            inputProps={{ "aria-label": `Enable time window for check-in point ${idx + 1}` }}
            sx={{ "& .Mui-checked": { color: ACCENT } }}
          />
        }
        label={<Typography sx={{ fontSize: 13, fontWeight: 600 }}>Add a time window</Typography>}
      />
      {hasWindow && (
        <Box sx={{ display: "flex", gap: 1.5, mt: 1, flexWrap: "wrap" }}>
          <TextField
            size="small"
            type="datetime-local"
            label="Window Start"
            value={isoToLocalInput(point.timeWindow?.start)}
            onChange={(e) => updateWindow("start", localInputToIso(e.target.value))}
            error={!!errors[`checkInPoints[${idx}].timeWindow.start`]}
            helperText={errors[`checkInPoints[${idx}].timeWindow.start`] || "Check-ins open"}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 240 }}
          />
          <TextField
            size="small"
            type="datetime-local"
            label="Window End"
            value={isoToLocalInput(point.timeWindow?.end)}
            onChange={(e) => updateWindow("end", localInputToIso(e.target.value))}
            error={!!errors[`checkInPoints[${idx}].timeWindow.end`]}
            helperText={errors[`checkInPoints[${idx}].timeWindow.end`] || "Check-ins close"}
            InputLabelProps={{ shrink: true }}
            sx={{ width: 240 }}
          />
        </Box>
      )}
    </Box>
  );
});

PointEditor.displayName = "PointEditor";

/**
 * MilestoneEditor — isolated editor for a single milestone reward. Memoized so
 * editing one milestone does not re-render siblings and text fields keep focus.
 * The threshold-count and required-set controls are conditioned on the selected
 * milestone type (Requirement 11.3).
 */
const MilestoneEditor = memo(({ milestone, idx, points, errors, onUpdate, onDelete }) => {
  const rewardLabelValue = milestone.rewardLabel ?? "";

  const updateReqSet = (value) => {
    // MUI multi-select returns an array of selected ids.
    onUpdate({ ...milestone, requiredSet: typeof value === "string" ? value.split(",") : value });
  };

  return (
    <Box
      data-testid={`milestone-editor-${idx}`}
      sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
          Milestone {idx + 1}
        </Typography>
        <IconButton
          size="small"
          aria-label={`Remove milestone ${idx + 1}`}
          onClick={onDelete}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 200 }} error={!!errors[`milestoneRewards[${idx}].type`]}>
          <InputLabel id={`ms-type-${idx}`}>Milestone Type</InputLabel>
          <Select
            labelId={`ms-type-${idx}`}
            label="Milestone Type"
            value={milestone.type || "threshold"}
            onChange={(e) => onUpdate({ ...milestone, type: e.target.value })}
            inputProps={{ "aria-label": `Milestone type for milestone ${idx + 1}` }}
          >
            {MILESTONE_TYPES.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          size="small"
          type="number"
          label="Reward Points (optional)"
          value={milestone.rewardPoints ?? ""}
          onChange={(e) =>
            onUpdate({
              ...milestone,
              rewardPoints: e.target.value === "" ? "" : parseInt(e.target.value, 10),
            })
          }
          error={!!errors[`milestoneRewards[${idx}].rewardPoints`]}
          helperText={
            errors[`milestoneRewards[${idx}].rewardPoints`] ||
            `${LIMITS.MIN_REWARD_POINTS}–${LIMITS.MAX_REWARD_POINTS}`
          }
          inputProps={{ min: LIMITS.MIN_REWARD_POINTS, max: LIMITS.MAX_REWARD_POINTS }}
          sx={{ width: 200 }}
        />
      </Box>

      <TextField
        fullWidth
        size="small"
        label="Reward Label"
        value={rewardLabelValue}
        onChange={(e) => onUpdate({ ...milestone, rewardLabel: e.target.value })}
        error={!!errors[`milestoneRewards[${idx}].rewardLabel`]}
        helperText={
          errors[`milestoneRewards[${idx}].rewardLabel`] ||
          `${rewardLabelValue.length}/${LIMITS.MAX_REWARD_LABEL}`
        }
        inputProps={{ maxLength: LIMITS.MAX_REWARD_LABEL + 1 }}
        sx={{ mb: 2 }}
      />

      {milestone.type === "threshold" ? (
        <TextField
          size="small"
          type="number"
          label="Threshold Count"
          value={milestone.thresholdCount ?? ""}
          onChange={(e) =>
            onUpdate({
              ...milestone,
              thresholdCount: e.target.value === "" ? "" : parseInt(e.target.value, 10),
            })
          }
          error={!!errors[`milestoneRewards[${idx}].thresholdCount`]}
          helperText={
            errors[`milestoneRewards[${idx}].thresholdCount`] ||
            `Number of check-ins to earn this (1–${points.length})`
          }
          inputProps={{ min: 1, max: points.length }}
          sx={{ width: 260 }}
        />
      ) : (
        <FormControl
          size="small"
          fullWidth
          error={!!errors[`milestoneRewards[${idx}].requiredSet`]}
        >
          <InputLabel id={`ms-reqset-${idx}`}>Required Set</InputLabel>
          <Select
            labelId={`ms-reqset-${idx}`}
            label="Required Set"
            multiple
            value={milestone.requiredSet || []}
            onChange={(e) => updateReqSet(e.target.value)}
            inputProps={{ "aria-label": `Required set for milestone ${idx + 1}` }}
            renderValue={(selected) =>
              (selected || [])
                .map((id) => points.find((p) => p.id === id)?.label || id)
                .join(", ")
            }
          >
            {points.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.label || p.id}
              </MenuItem>
            ))}
          </Select>
          {errors[`milestoneRewards[${idx}].requiredSet`] && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
              {errors[`milestoneRewards[${idx}].requiredSet`]}
            </Typography>
          )}
        </FormControl>
      )}
    </Box>
  );
});

MilestoneEditor.displayName = "MilestoneEditor";

/**
 * CheckInChallengeConfig — organizer-facing configuration screen for a Check-In
 * Challenges experience instance. Mirrors PredictionConfig/RaffleConfig's
 * stepped MUI form: memoized point/milestone editors preserving input focus, an
 * errors map keyed by field path, client-side validation reproducing the plugin
 * rules, a QR association control whose code is minted by the QR Code System
 * (never free-typed), and a save that persists the config via updateInstance.
 */
const CheckInChallengeConfig = () => {
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
        if (!cancelled && cfg?.checkInPoints?.length) {
          setForm({
            checkInPoints: cfg.checkInPoints.map((pt, pi) => ({
              id: pt.id || `pt-${pi}`,
              label: pt.label ?? "",
              checkInCode: pt.checkInCode ?? "",
              pointValue: pt.pointValue ?? 100,
              timeWindow: pt.timeWindow || null,
            })),
            milestoneRewards: (cfg.milestoneRewards || []).map((ms, mi) => ({
              id: ms.id || `ms-${mi}`,
              type: ms.type || "threshold",
              rewardLabel: ms.rewardLabel ?? "",
              rewardPoints: ms.rewardPoints ?? "",
              thresholdCount: ms.thresholdCount ?? 1,
              requiredSet: ms.requiredSet || [],
            })),
            leaderboardEnabled: cfg.leaderboardEnabled !== false,
          });
        }
      } catch (err) {
        // Non-fatal: a brand-new instance has no config yet.
        console.log("CheckInChallengeConfig: no existing config", err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, experienceId]);

  // ── Check-in point mutations ──────────────────────────────────────────────
  const updatePoint = (idx, updated) => {
    setForm((prev) => ({
      ...prev,
      checkInPoints: prev.checkInPoints.map((p, i) => (i === idx ? updated : p)),
    }));
    setSaved(false);
  };

  const addPoint = () => {
    setForm((prev) =>
      prev.checkInPoints.length >= LIMITS.MAX_POINTS
        ? prev
        : { ...prev, checkInPoints: [...prev.checkInPoints, makePoint()] }
    );
    setSaved(false);
  };

  const removePoint = (idx) => {
    setForm((prev) => {
      if (prev.checkInPoints.length <= LIMITS.MIN_POINTS) return prev;
      const removedId = prev.checkInPoints[idx]?.id;
      return {
        ...prev,
        checkInPoints: prev.checkInPoints.filter((_, i) => i !== idx),
        // Drop the removed point from any milestone required sets so they stay valid.
        milestoneRewards: prev.milestoneRewards.map((ms) =>
          ms.requiredSet?.length
            ? { ...ms, requiredSet: ms.requiredSet.filter((id) => id !== removedId) }
            : ms
        ),
      };
    });
    setSaved(false);
  };

  // Associate a QR check-in code with a point. The value is supplied by the QR
  // Code System (Requirements 3.1, 3.2) — here we simulate the QR system minting
  // an opaque, unique code string. It is never free-typed by the organizer.
  const associateCode = (idx) => {
    setForm((prev) => {
      const code = `EVT-${(experienceId || "EXP").slice(-4).toUpperCase()}-CIP-${uid("").slice(-6).toUpperCase()}`;
      return {
        ...prev,
        checkInPoints: prev.checkInPoints.map((p, i) =>
          i === idx ? { ...p, checkInCode: code } : p
        ),
      };
    });
    setSaved(false);
  };

  // ── Milestone mutations ───────────────────────────────────────────────────
  const updateMilestone = (idx, updated) => {
    setForm((prev) => ({
      ...prev,
      milestoneRewards: prev.milestoneRewards.map((m, i) => (i === idx ? updated : m)),
    }));
    setSaved(false);
  };

  const addMilestone = () => {
    setForm((prev) =>
      prev.milestoneRewards.length >= LIMITS.MAX_MILESTONES
        ? prev
        : { ...prev, milestoneRewards: [...prev.milestoneRewards, makeMilestone()] }
    );
    setSaved(false);
  };

  const removeMilestone = (idx) => {
    setForm((prev) => ({
      ...prev,
      milestoneRewards: prev.milestoneRewards.filter((_, i) => i !== idx),
    }));
    setSaved(false);
  };

  const setLeaderboardEnabled = (enabled) => {
    setForm((prev) => ({ ...prev, leaderboardEnabled: enabled }));
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
        leaderboardEnabled: !!form.leaderboardEnabled,
        checkInPoints: form.checkInPoints.map((pt) => {
          const out = {
            id: pt.id,
            label: pt.label.trim(),
            checkInCode: (pt.checkInCode || "").trim(),
            pointValue: Number(pt.pointValue),
          };
          if (pt.timeWindow && pt.timeWindow.start && pt.timeWindow.end) {
            out.timeWindow = { start: pt.timeWindow.start, end: pt.timeWindow.end };
          }
          return out;
        }),
        milestoneRewards: form.milestoneRewards.map((ms) => {
          const out = {
            id: ms.id,
            type: ms.type,
            rewardLabel: ms.rewardLabel.trim(),
          };
          if (ms.rewardPoints !== "" && ms.rewardPoints !== null && ms.rewardPoints !== undefined) {
            out.rewardPoints = Number(ms.rewardPoints);
          }
          if (ms.type === "threshold") {
            out.thresholdCount = Number(ms.thresholdCount);
          } else if (ms.type === "required-set") {
            out.requiredSet = [...(ms.requiredSet || [])];
          }
          return out;
        }),
      };
      await updateInstance(eventId, experienceId, { config });
      setSaved(true);
    } catch (err) {
      setSaveError(
        err.response?.data?.message || err.message || "Failed to save check-in challenge configuration."
      );
    } finally {
      setSaving(false);
    }
  };

  const renderPointsStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Check-In Points ({form.checkInPoints.length}/{LIMITS.MAX_POINTS})
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Define each location or session attendees can check in at. Associate a QR code, set a point value, and optionally restrict check-ins to a time window.
      </Typography>

      {errors["checkInPoints"] && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {errors["checkInPoints"]}
        </Alert>
      )}

      {form.checkInPoints.map((point, idx) => (
        <PointEditor
          key={point.id}
          point={point}
          idx={idx}
          count={form.checkInPoints.length}
          errors={errors}
          onUpdate={(updated) => updatePoint(idx, updated)}
          onDelete={() => removePoint(idx)}
          onAssociate={() => associateCode(idx)}
        />
      ))}

      <Button
        startIcon={<AddIcon />}
        onClick={addPoint}
        disabled={form.checkInPoints.length >= LIMITS.MAX_POINTS}
        variant="outlined"
        sx={{ textTransform: "none", borderColor: ACCENT, color: ACCENT }}
      >
        Add Check-In Point
      </Button>
    </Box>
  );

  const renderMilestonesStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Milestone Rewards ({form.milestoneRewards.length}/{LIMITS.MAX_MILESTONES})
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Reward attendees for reaching a check-in threshold or completing a required set of points. Milestones are optional.
      </Typography>

      {errors["milestoneRewards"] && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {errors["milestoneRewards"]}
        </Alert>
      )}

      {form.milestoneRewards.length === 0 && (
        <Typography sx={{ fontSize: 13, color: "#9CA3AF", mb: 2 }}>
          No milestone rewards configured.
        </Typography>
      )}

      {form.milestoneRewards.map((milestone, idx) => (
        <MilestoneEditor
          key={milestone.id}
          milestone={milestone}
          idx={idx}
          points={form.checkInPoints}
          errors={errors}
          onUpdate={(updated) => updateMilestone(idx, updated)}
          onDelete={() => removeMilestone(idx)}
        />
      ))}

      <Button
        startIcon={<AddIcon />}
        onClick={addMilestone}
        disabled={form.milestoneRewards.length >= LIMITS.MAX_MILESTONES}
        variant="outlined"
        sx={{ textTransform: "none", borderColor: ACCENT, color: ACCENT }}
      >
        Add Milestone Reward
      </Button>
    </Box>
  );

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Settings & Review
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Configure the leaderboard, review the challenge, then save the configuration to this experience.
      </Typography>

      {/* Leaderboard setting (Requirement 11.4). */}
      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}>
        <FormControlLabel
          control={
            <Switch
              checked={!!form.leaderboardEnabled}
              onChange={(e) => setLeaderboardEnabled(e.target.checked)}
              inputProps={{ "aria-label": "Enable leaderboard" }}
              sx={{ "& .Mui-checked": { color: ACCENT } }}
            />
          }
          label={
            <Box>
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>Leaderboard</Typography>
              <Typography sx={{ fontSize: 12, color: "#6B7280" }}>
                Rank attendees by the points they earn.
              </Typography>
            </Box>
          }
        />
      </Box>

      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#F8F9FA" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>
          {form.checkInPoints.length} check-in point{form.checkInPoints.length === 1 ? "" : "s"} ·{" "}
          {form.milestoneRewards.length} milestone{form.milestoneRewards.length === 1 ? "" : "s"}
        </Typography>
        {form.checkInPoints.map((pt, idx) => (
          <Typography key={pt.id} sx={{ fontSize: 13, color: "#374151" }}>
            {idx + 1}. {pt.label || `Point ${idx + 1}`}{" "}
            <Typography component="span" sx={{ fontSize: 12, color: "#6B7280" }}>
              ({pt.pointValue} pts{pt.timeWindow ? " · windowed" : ""})
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
          Check-in challenge configuration saved.
        </Alert>
      )}

      <button type="button" className="cic-bn" onClick={handleSave} disabled={saving}>
        {saving ? "Saving..." : "Save Configuration"}
      </button>
    </Box>
  );

  const renderStep = () => {
    if (activeStep === 0) return renderPointsStep();
    if (activeStep === 1) return renderMilestonesStep();
    return renderReviewStep();
  };

  return (
    <div className="cic-wrap">
      <style>{CIC_STYLES}</style>
      <Box sx={{ maxWidth: 900, mx: "auto" }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <CheckCircleOutlineIcon sx={{ color: ACCENT, fontSize: 28 }} />
          <h1 className="cic-pg-h" style={{ margin: 0 }}>
            Configure Check-In Challenges
          </h1>
        </Box>
        <p className="cic-pg-s">
          Reward attendees for checking in at your sessions, booths, and locations.
        </p>

        {/* Step indicator */}
        <div className="cic-steps" style={{ marginBottom: 24 }}>
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              className={`cic-step-btn${
                activeStep === i ? " cur" : activeStep > i ? " done" : ""
              }`}
              onClick={() => setActiveStep(i)}
              style={{ cursor: "pointer" }}
            >
              {i + 1}. {label}
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="cic-card" style={{ minHeight: 300 }}>
          {renderStep()}
        </div>

        {/* Navigation */}
        <div className="cic-foot">
          <button
            type="button"
            className="cic-bb"
            onClick={() =>
              activeStep === 0
                ? navigate(`/admin/my-events/${eventId}/experiences`)
                : setActiveStep(activeStep - 1)
            }
          >
            {activeStep === 0 ? "Cancel" : "‹ Back"}
          </button>
          {activeStep < STEPS.length - 1 && (
            <button
              type="button"
              className="cic-bn"
              onClick={() => setActiveStep(activeStep + 1)}
            >
              Next →
            </button>
          )}
        </div>
      </Box>
    </div>
  );
};

export default CheckInChallengeConfig;
