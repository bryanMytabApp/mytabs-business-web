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
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import { getInstance, updateInstance } from "../../services/experienceService";
import ThemeColorPicker from "./ThemeColorPicker";
import EngagementConfigShell from "./EngagementConfigShell";

const ACCENT = "#8B5CF6"; // Engagement & Loyalty brand color
const DEFAULT_ACCENT = "#8B5CF6"; // default theme color saved when none chosen

// Config limits — mirror the plugin's validateConfig rules (Requirement 1).
const LIMITS = {
  MIN_RULES: 1,
  MAX_RULES: 50,
  MIN_REWARDS: 1,
  MAX_REWARDS: 100,
  MIN_TIERS: 1,
  MAX_TIERS: 10,
  MAX_LABEL: 100,
  MIN_POINTS: 1,
  MAX_POINTS: 1000000,
  MIN_QUANTITY: 1,
  MAX_QUANTITY: 1000000,
};

// Action types an Earning_Rule may grant points for (Requirement 1.3).
const ACTION_TYPES = [
  { value: "attend-event", label: "Attend event" },
  { value: "check-in", label: "Check in" },
  { value: "complete-survey", label: "Complete survey" },
  { value: "refer-friend", label: "Refer a friend" },
  { value: "generic-grant", label: "Generic grant" },
];

const INVENTORY_MODES = [
  { value: "unlimited", label: "Unlimited" },
  { value: "finite", label: "Finite (limited quantity)" },
];

const STEPS = ["Earning Rules", "Rewards Catalog", "Membership Tiers", "Review & Save"];

let idCounter = 0;
const uid = (prefix) => `${prefix}-${Date.now()}-${idCounter++}`;

const makeRule = () => ({
  id: uid("rule"),
  actionType: "attend-event",
  pointsValue: 100,
  earnCap: "", // blank = uncapped
});

const makeReward = () => ({
  id: uid("reward"),
  rewardLabel: "",
  pointCost: 100,
  inventoryMode: "unlimited",
  totalQuantity: 100,
});

const makeTier = () => ({
  id: uid("tier"),
  tierName: "",
  tierThreshold: 0,
  tierBenefit: "",
});

const DEFAULT_FORM = {
  accentColor: DEFAULT_ACCENT,
  earningRules: [makeRule()],
  rewards: [makeReward()],
  membershipTiers: [], // Requirement 10.4 — zero tiers is allowed.
};

/**
 * Validates the loyalty configuration form, reproducing the backend plugin
 * rules (Requirements 1.2–1.13) into an errors map keyed by field path (e.g.
 * `rewards[2].pointCost`) so each control can surface its own error. Returns an
 * object of { fieldPath: message }. The plugin's validateConfig remains the
 * server-side authority.
 */
export function validateAll(form) {
  const errors = {};
  const earningRules = form?.earningRules || [];
  const rewards = form?.rewards || [];
  const membershipTiers = form?.membershipTiers || [];

  const isInt = (n) => Number.isInteger(n);

  // ── Earning Rules ──────────────────────────────────────────────────────────
  // Rule 1.2 — earning-rule count 1..50.
  if (earningRules.length < LIMITS.MIN_RULES) {
    errors["earningRules"] = `At least ${LIMITS.MIN_RULES} earning rule is required.`;
  } else if (earningRules.length > LIMITS.MAX_RULES) {
    errors["earningRules"] = `A maximum of ${LIMITS.MAX_RULES} earning rules is allowed.`;
  }

  // Rule 1.13 — duplicate ruleId detection.
  const seenRuleIds = new Map();

  earningRules.forEach((rule, idx) => {
    // Rule 1.3 — actionType membership.
    if (!ACTION_TYPES.some((a) => a.value === rule.actionType)) {
      errors[`earningRules[${idx}].actionType`] = "Select a valid action type.";
    }

    // Rule 1.4 — pointsValue integer 1..1,000,000.
    const points = Number(rule.pointsValue);
    if (!isInt(points) || points < LIMITS.MIN_POINTS || points > LIMITS.MAX_POINTS) {
      errors[`earningRules[${idx}].pointsValue`] = `Points value must be an integer between ${LIMITS.MIN_POINTS} and ${LIMITS.MAX_POINTS.toLocaleString()}.`;
    }

    // Rule 1.5 — earnCap (when present) integer 1..1,000,000; blank = uncapped.
    if (rule.earnCap !== "" && rule.earnCap !== null && rule.earnCap !== undefined) {
      const cap = Number(rule.earnCap);
      if (!isInt(cap) || cap < LIMITS.MIN_POINTS || cap > LIMITS.MAX_POINTS) {
        errors[`earningRules[${idx}].earnCap`] = `Earn cap must be an integer between ${LIMITS.MIN_POINTS} and ${LIMITS.MAX_POINTS.toLocaleString()}, or left blank.`;
      }
    }

    // Rule 1.13 — duplicate ruleId flagged at the offending rule.
    const ruleId = rule.id;
    if (ruleId) {
      if (seenRuleIds.has(ruleId)) {
        errors[`earningRules[${idx}].ruleId`] = `Duplicate rule id: ${ruleId}.`;
      } else {
        seenRuleIds.set(ruleId, idx);
      }
    }
  });

  // ── Rewards Catalog ────────────────────────────────────────────────────────
  // Rule 1.6 — rewards count 1..100.
  if (rewards.length < LIMITS.MIN_REWARDS) {
    errors["rewards"] = `At least ${LIMITS.MIN_REWARDS} reward is required.`;
  } else if (rewards.length > LIMITS.MAX_REWARDS) {
    errors["rewards"] = `A maximum of ${LIMITS.MAX_REWARDS} rewards is allowed.`;
  }

  // Rule 1.13 — duplicate rewardId detection.
  const seenRewardIds = new Map();

  rewards.forEach((reward, idx) => {
    // Rule 1.7 — rewardLabel non-empty, <= 100 chars.
    const label = (reward.rewardLabel ?? "").trim();
    if (label.length < 1) {
      errors[`rewards[${idx}].rewardLabel`] = "A reward label is required.";
    } else if (label.length > LIMITS.MAX_LABEL) {
      errors[`rewards[${idx}].rewardLabel`] = `Reward label must be ${LIMITS.MAX_LABEL} characters or fewer.`;
    }

    // Rule 1.8 — pointCost integer 1..1,000,000.
    const cost = Number(reward.pointCost);
    if (!isInt(cost) || cost < LIMITS.MIN_POINTS || cost > LIMITS.MAX_POINTS) {
      errors[`rewards[${idx}].pointCost`] = `Point cost must be an integer between ${LIMITS.MIN_POINTS} and ${LIMITS.MAX_POINTS.toLocaleString()}.`;
    }

    // Rule 1.9/1.10 — finite rewards require an integer totalQuantity 1..1,000,000;
    // unlimited rewards carry no quantity.
    if (reward.inventoryMode === "finite") {
      const qty = Number(reward.totalQuantity);
      if (!isInt(qty) || qty < LIMITS.MIN_QUANTITY || qty > LIMITS.MAX_QUANTITY) {
        errors[`rewards[${idx}].totalQuantity`] = `Total quantity must be an integer between ${LIMITS.MIN_QUANTITY} and ${LIMITS.MAX_QUANTITY.toLocaleString()}.`;
      }
    }

    // Rule 1.13 — duplicate rewardId flagged at the offending reward.
    const rewardId = reward.id;
    if (rewardId) {
      if (seenRewardIds.has(rewardId)) {
        errors[`rewards[${idx}].rewardId`] = `Duplicate reward id: ${rewardId}.`;
      } else {
        seenRewardIds.set(rewardId, idx);
      }
    }
  });

  // ── Membership Tiers (optional) ──────────────────────────────────────────────
  // Rule 1.11 — when present, tier count 1..10 with each threshold a non-negative
  // integer. Zero tiers is allowed (no error).
  if (membershipTiers.length > 0) {
    if (membershipTiers.length > LIMITS.MAX_TIERS) {
      errors["membershipTiers"] = `A maximum of ${LIMITS.MAX_TIERS} membership tiers is allowed.`;
    }

    // Rule 1.12 — no two tiers share an identical threshold.
    const seenThresholds = new Map();
    // Rule 1.13 — duplicate tierId detection.
    const seenTierIds = new Map();

    membershipTiers.forEach((tier, idx) => {
      const threshold = Number(tier.tierThreshold);
      if (!isInt(threshold) || threshold < 0) {
        errors[`membershipTiers[${idx}].tierThreshold`] = "Tier threshold must be a non-negative integer.";
      } else if (seenThresholds.has(threshold)) {
        errors[`membershipTiers[${idx}].tierThreshold`] = `Another tier already uses the threshold ${threshold}.`;
      } else {
        seenThresholds.set(threshold, idx);
      }

      const tierId = tier.id;
      if (tierId) {
        if (seenTierIds.has(tierId)) {
          errors[`membershipTiers[${idx}].tierId`] = `Duplicate tier id: ${tierId}.`;
        } else {
          seenTierIds.set(tierId, idx);
        }
      }
    });
  }

  return errors;
}

/**
 * RuleItem — isolated editor for a single Earning_Rule. Wrapped in React.memo
 * (like Raffles' PrizeItem) so editing one rule does not re-render siblings and
 * text fields keep focus across keystrokes (Requirement 10.2).
 */
const RuleItem = memo(({ rule, idx, count, errors, onUpdate, onDelete }) => {
  const updateField = (key, value) => onUpdate({ ...rule, [key]: value });

  const updateNumber = (key, raw) => {
    const value = raw === "" ? "" : parseInt(raw, 10);
    onUpdate({ ...rule, [key]: value });
  };

  return (
    <Box
      data-testid={`rule-editor-${idx}`}
      sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
          Earning Rule {idx + 1}
        </Typography>
        <IconButton
          size="small"
          aria-label={`Remove earning rule ${idx + 1}`}
          onClick={onDelete}
          disabled={count <= LIMITS.MIN_RULES}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "flex-start" }}>
        <FormControl size="small" sx={{ minWidth: 220 }} error={!!errors[`earningRules[${idx}].actionType`]}>
          <InputLabel id={`action-type-label-${idx}`}>Action Type</InputLabel>
          <Select
            labelId={`action-type-label-${idx}`}
            label="Action Type"
            value={rule.actionType}
            onChange={(e) => updateField("actionType", e.target.value)}
            inputProps={{ "aria-label": `Action type for earning rule ${idx + 1}` }}
          >
            {ACTION_TYPES.map((a) => (
              <MenuItem key={a.value} value={a.value}>
                {a.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <TextField
          size="small"
          type="number"
          label="Points Value"
          value={rule.pointsValue ?? ""}
          onChange={(e) => updateNumber("pointsValue", e.target.value)}
          error={!!errors[`earningRules[${idx}].pointsValue`]}
          helperText={
            errors[`earningRules[${idx}].pointsValue`] ||
            `${LIMITS.MIN_POINTS}–${LIMITS.MAX_POINTS.toLocaleString()}`
          }
          inputProps={{
            min: LIMITS.MIN_POINTS,
            max: LIMITS.MAX_POINTS,
            "aria-label": `Points value for earning rule ${idx + 1}`,
          }}
          sx={{ width: 180 }}
        />

        <TextField
          size="small"
          type="number"
          label="Earn Cap (optional)"
          value={rule.earnCap ?? ""}
          onChange={(e) => updateNumber("earnCap", e.target.value)}
          error={!!errors[`earningRules[${idx}].earnCap`]}
          helperText={errors[`earningRules[${idx}].earnCap`] || "Blank = uncapped"}
          inputProps={{
            min: LIMITS.MIN_POINTS,
            max: LIMITS.MAX_POINTS,
            "aria-label": `Earn cap for earning rule ${idx + 1}`,
          }}
          sx={{ width: 180 }}
        />
      </Box>
    </Box>
  );
});

RuleItem.displayName = "RuleItem";

/**
 * RewardItem — isolated editor for a single Reward. React.memo keeps focus
 * stable across sibling edits. The Total_Quantity control is shown/enabled only
 * when the inventory mode is `finite` and hidden when `unlimited`
 * (Requirement 10.6).
 */
const RewardItem = memo(({ reward, idx, count, errors, onUpdate, onDelete }) => {
  const labelValue = reward.rewardLabel ?? "";
  const isFinite = reward.inventoryMode === "finite";

  const updateField = (key, value) => onUpdate({ ...reward, [key]: value });

  const updateNumber = (key, raw) => {
    const value = raw === "" ? "" : parseInt(raw, 10);
    onUpdate({ ...reward, [key]: value });
  };

  return (
    <Box
      data-testid={`reward-editor-${idx}`}
      sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
          Reward {idx + 1}
        </Typography>
        <IconButton
          size="small"
          aria-label={`Remove reward ${idx + 1}`}
          onClick={onDelete}
          disabled={count <= LIMITS.MIN_REWARDS}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <TextField
        fullWidth
        size="small"
        label="Reward Label"
        value={labelValue}
        onChange={(e) => updateField("rewardLabel", e.target.value)}
        error={!!errors[`rewards[${idx}].rewardLabel`]}
        helperText={errors[`rewards[${idx}].rewardLabel`] || `${labelValue.length}/${LIMITS.MAX_LABEL}`}
        inputProps={{ maxLength: LIMITS.MAX_LABEL + 1 }}
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "flex-start" }}>
        <TextField
          size="small"
          type="number"
          label="Point Cost"
          value={reward.pointCost ?? ""}
          onChange={(e) => updateNumber("pointCost", e.target.value)}
          error={!!errors[`rewards[${idx}].pointCost`]}
          helperText={
            errors[`rewards[${idx}].pointCost`] ||
            `${LIMITS.MIN_POINTS}–${LIMITS.MAX_POINTS.toLocaleString()}`
          }
          inputProps={{
            min: LIMITS.MIN_POINTS,
            max: LIMITS.MAX_POINTS,
            "aria-label": `Point cost for reward ${idx + 1}`,
          }}
          sx={{ width: 180 }}
        />

        <FormControl size="small" sx={{ minWidth: 220 }} error={!!errors[`rewards[${idx}].inventoryMode`]}>
          <InputLabel id={`inventory-mode-label-${idx}`}>Inventory</InputLabel>
          <Select
            labelId={`inventory-mode-label-${idx}`}
            label="Inventory"
            value={reward.inventoryMode}
            onChange={(e) => updateField("inventoryMode", e.target.value)}
            inputProps={{ "aria-label": `Inventory for reward ${idx + 1}` }}
          >
            {INVENTORY_MODES.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Total quantity is shown/enabled only when finite (Requirement 10.6). */}
        {isFinite && (
          <TextField
            size="small"
            type="number"
            label="Total Quantity"
            value={reward.totalQuantity ?? ""}
            onChange={(e) => updateNumber("totalQuantity", e.target.value)}
            error={!!errors[`rewards[${idx}].totalQuantity`]}
            helperText={
              errors[`rewards[${idx}].totalQuantity`] ||
              `${LIMITS.MIN_QUANTITY}–${LIMITS.MAX_QUANTITY.toLocaleString()}`
            }
            inputProps={{
              min: LIMITS.MIN_QUANTITY,
              max: LIMITS.MAX_QUANTITY,
              "aria-label": `Total quantity for reward ${idx + 1}`,
            }}
            sx={{ width: 200 }}
          />
        )}
      </Box>
    </Box>
  );
});

RewardItem.displayName = "RewardItem";

/**
 * TierItem — isolated editor for a single Membership_Tier. React.memo keeps
 * focus stable across sibling edits (Requirement 10.4).
 */
const TierItem = memo(({ tier, idx, count, errors, onUpdate, onDelete }) => {
  const nameValue = tier.tierName ?? "";
  const benefitValue = tier.tierBenefit ?? "";

  const updateField = (key, value) => onUpdate({ ...tier, [key]: value });

  const updateNumber = (key, raw) => {
    const value = raw === "" ? "" : parseInt(raw, 10);
    onUpdate({ ...tier, [key]: value });
  };

  return (
    <Box
      data-testid={`tier-editor-${idx}`}
      sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#fff" }}
    >
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, fontSize: 13 }}>
          Membership Tier {idx + 1}
        </Typography>
        <IconButton
          size="small"
          aria-label={`Remove membership tier ${idx + 1}`}
          onClick={onDelete}
          disabled={count <= LIMITS.MIN_TIERS}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ display: "flex", gap: 1.5, mb: 2, flexWrap: "wrap", alignItems: "flex-start" }}>
        <TextField
          size="small"
          label="Tier Name"
          value={nameValue}
          onChange={(e) => updateField("tierName", e.target.value)}
          error={!!errors[`membershipTiers[${idx}].tierName`]}
          helperText={errors[`membershipTiers[${idx}].tierName`] || " "}
          inputProps={{ "aria-label": `Tier name for membership tier ${idx + 1}` }}
          sx={{ flex: 1, minWidth: 200 }}
        />
        <TextField
          size="small"
          type="number"
          label="Tier Threshold"
          value={tier.tierThreshold ?? ""}
          onChange={(e) => updateNumber("tierThreshold", e.target.value)}
          error={!!errors[`membershipTiers[${idx}].tierThreshold`]}
          helperText={errors[`membershipTiers[${idx}].tierThreshold`] || "Lifetime points to reach"}
          inputProps={{
            min: 0,
            "aria-label": `Tier threshold for membership tier ${idx + 1}`,
          }}
          sx={{ width: 200 }}
        />
      </Box>

      <TextField
        fullWidth
        size="small"
        label="Tier Benefit"
        value={benefitValue}
        onChange={(e) => updateField("tierBenefit", e.target.value)}
        error={!!errors[`membershipTiers[${idx}].tierBenefit`]}
        helperText={errors[`membershipTiers[${idx}].tierBenefit`] || "Describe the benefit for this tier."}
        inputProps={{ "aria-label": `Tier benefit for membership tier ${idx + 1}` }}
      />
    </Box>
  );
});

TierItem.displayName = "TierItem";

/**
 * LoyaltyConfig — organizer-facing configuration screen for a Loyalty & Rewards
 * experience instance. Mirrors RaffleConfig/CouponConfig's stepped MUI form:
 * memoized editors preserving input focus, an errors map keyed by field path,
 * client-side validation reproducing the plugin rules (1.2–1.13), and a save
 * that persists the config via updateInstance. The saved config shapes each
 * reward's inventory as `'unlimited'` or `{ totalQuantity }` to match the
 * plugin's Loyalty_Config.
 */
const LoyaltyConfig = () => {
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
        if (!cancelled && (cfg?.earningRules?.length || cfg?.rewards?.length)) {
          setForm({
            accentColor: cfg.accentColor || DEFAULT_ACCENT,
            earningRules: (cfg.earningRules || []).map((r, ri) => ({
              id: r.ruleId || r.id || `rule-${ri}`,
              actionType: r.actionType || "attend-event",
              pointsValue: r.pointsValue ?? 100,
              earnCap: r.earnCap ?? "",
            })),
            rewards: (cfg.rewards || []).map((rw, wi) => ({
              id: rw.rewardId || rw.id || `reward-${wi}`,
              rewardLabel: rw.rewardLabel ?? "",
              pointCost: rw.pointCost ?? 100,
              inventoryMode: rw.inventory === "unlimited" || rw.inventory?.mode === "unlimited" ? "unlimited" : "finite",
              totalQuantity:
                typeof rw.inventory === "object" ? rw.inventory?.totalQuantity ?? 100 : 100,
            })),
            membershipTiers: (cfg.membershipTiers || []).map((t, ti) => ({
              id: t.tierId || t.id || `tier-${ti}`,
              tierName: t.tierName ?? "",
              tierThreshold: t.tierThreshold ?? 0,
              tierBenefit: t.tierBenefit ?? "",
            })),
          });
        }
      } catch (err) {
        // Non-fatal: a brand-new instance has no config yet.
        console.log("LoyaltyConfig: no existing config", err?.message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, experienceId]);

  // ── Earning-rule mutations ───────────────────────────────────────────────────
  const updateRule = (idx, updated) => {
    setForm((prev) => ({
      ...prev,
      earningRules: prev.earningRules.map((r, i) => (i === idx ? updated : r)),
    }));
    setSaved(false);
  };

  const addRule = () => {
    setForm((prev) =>
      prev.earningRules.length >= LIMITS.MAX_RULES
        ? prev
        : { ...prev, earningRules: [...prev.earningRules, makeRule()] }
    );
    setSaved(false);
  };

  const removeRule = (idx) => {
    setForm((prev) => {
      if (prev.earningRules.length <= LIMITS.MIN_RULES) return prev;
      return { ...prev, earningRules: prev.earningRules.filter((_, i) => i !== idx) };
    });
    setSaved(false);
  };

  // ── Reward mutations ─────────────────────────────────────────────────────────
  const updateReward = (idx, updated) => {
    setForm((prev) => ({
      ...prev,
      rewards: prev.rewards.map((r, i) => (i === idx ? updated : r)),
    }));
    setSaved(false);
  };

  const addReward = () => {
    setForm((prev) =>
      prev.rewards.length >= LIMITS.MAX_REWARDS
        ? prev
        : { ...prev, rewards: [...prev.rewards, makeReward()] }
    );
    setSaved(false);
  };

  const removeReward = (idx) => {
    setForm((prev) => {
      if (prev.rewards.length <= LIMITS.MIN_REWARDS) return prev;
      return { ...prev, rewards: prev.rewards.filter((_, i) => i !== idx) };
    });
    setSaved(false);
  };

  // ── Membership-tier mutations ────────────────────────────────────────────────
  const updateTier = (idx, updated) => {
    setForm((prev) => ({
      ...prev,
      membershipTiers: prev.membershipTiers.map((t, i) => (i === idx ? updated : t)),
    }));
    setSaved(false);
  };

  const addTier = () => {
    setForm((prev) =>
      prev.membershipTiers.length >= LIMITS.MAX_TIERS
        ? prev
        : { ...prev, membershipTiers: [...prev.membershipTiers, makeTier()] }
    );
    setSaved(false);
  };

  const removeTier = (idx) => {
    setForm((prev) => ({
      ...prev,
      membershipTiers: prev.membershipTiers.filter((_, i) => i !== idx),
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
        earningRules: form.earningRules.map((r) => {
          const rule = {
            ruleId: r.id,
            actionType: r.actionType,
            pointsValue: Number(r.pointsValue),
          };
          // An earnCap is optional — only include it when the organizer set one.
          if (r.earnCap !== "" && r.earnCap !== null && r.earnCap !== undefined) {
            rule.earnCap = Number(r.earnCap);
          }
          return rule;
        }),
        rewards: form.rewards.map((rw) => {
          const inventory =
            rw.inventoryMode === "unlimited"
              ? "unlimited"
              : { totalQuantity: Number(rw.totalQuantity) };
          return {
            rewardId: rw.id,
            rewardLabel: rw.rewardLabel.trim(),
            pointCost: Number(rw.pointCost),
            inventory,
          };
        }),
        // Membership tiers are optional; omit the key entirely when none configured.
        ...(form.membershipTiers.length > 0
          ? {
              membershipTiers: form.membershipTiers.map((t) => ({
                tierId: t.id,
                tierName: t.tierName.trim(),
                tierThreshold: Number(t.tierThreshold),
                tierBenefit: (t.tierBenefit || "").trim(),
              })),
            }
          : {}),
      };
      await updateInstance(eventId, experienceId, { config });
      setSaved(true);
      // Return to the engagements dashboard after a successful save (matches Raffle).
      navigate(`/admin/my-events/${eventId}/experiences`);
    } catch (err) {
      setSaveError(
        err.response?.data?.message || err.message || "Failed to save loyalty configuration."
      );
    } finally {
      setSaving(false);
    }
  };

  const renderRulesStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Earning Rules ({form.earningRules.length}/{LIMITS.MAX_RULES})
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Define how attendees earn points. Each rule grants points for an action, with an optional per-attendee earn cap.
      </Typography>

      <ThemeColorPicker
        value={form.accentColor}
        onChange={(hex) => {
          setForm((prev) => ({ ...prev, accentColor: hex }));
          setSaved(false);
        }}
        helper="Accent color used across this loyalty program's display"
      />

      {errors["earningRules"] && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {errors["earningRules"]}
        </Alert>
      )}

      {form.earningRules.map((rule, idx) => (
        <RuleItem
          key={rule.id}
          rule={rule}
          idx={idx}
          count={form.earningRules.length}
          errors={errors}
          onUpdate={(updated) => updateRule(idx, updated)}
          onDelete={() => removeRule(idx)}
        />
      ))}

      <Button
        startIcon={<AddIcon />}
        onClick={addRule}
        disabled={form.earningRules.length >= LIMITS.MAX_RULES}
        variant="outlined"
        sx={{ textTransform: "none", borderColor: ACCENT, color: ACCENT }}
      >
        Add Earning Rule
      </Button>
    </Box>
  );

  const renderRewardsStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Rewards Catalog ({form.rewards.length}/{LIMITS.MAX_REWARDS})
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Define the rewards attendees can redeem with points. Set the label, the point cost, and the inventory.
      </Typography>

      {errors["rewards"] && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {errors["rewards"]}
        </Alert>
      )}

      {form.rewards.map((reward, idx) => (
        <RewardItem
          key={reward.id}
          reward={reward}
          idx={idx}
          count={form.rewards.length}
          errors={errors}
          onUpdate={(updated) => updateReward(idx, updated)}
          onDelete={() => removeReward(idx)}
        />
      ))}

      <Button
        startIcon={<AddIcon />}
        onClick={addReward}
        disabled={form.rewards.length >= LIMITS.MAX_REWARDS}
        variant="outlined"
        sx={{ textTransform: "none", borderColor: ACCENT, color: ACCENT }}
      >
        Add Reward
      </Button>
    </Box>
  );

  const renderTiersStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Membership Tiers ({form.membershipTiers.length}/{LIMITS.MAX_TIERS})
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Optional. Reward repeat engagement with tiers based on lifetime accrued points. Leave empty for no tiers.
      </Typography>

      {errors["membershipTiers"] && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {errors["membershipTiers"]}
        </Alert>
      )}

      {form.membershipTiers.length === 0 && (
        <Typography sx={{ fontSize: 13, color: "#9CA3AF", mb: 2, fontStyle: "italic" }}>
          No membership tiers configured.
        </Typography>
      )}

      {form.membershipTiers.map((tier, idx) => (
        <TierItem
          key={tier.id}
          tier={tier}
          idx={idx}
          count={form.membershipTiers.length}
          errors={errors}
          onUpdate={(updated) => updateTier(idx, updated)}
          onDelete={() => removeTier(idx)}
        />
      ))}

      <Button
        startIcon={<AddIcon />}
        onClick={addTier}
        disabled={form.membershipTiers.length >= LIMITS.MAX_TIERS}
        variant="outlined"
        sx={{ textTransform: "none", borderColor: ACCENT, color: ACCENT }}
      >
        Add Membership Tier
      </Button>
    </Box>
  );

  const renderReviewStep = () => (
    <Box>
      <Typography variant="h6" sx={{ mb: 0.5 }}>
        Review & Save
      </Typography>
      <Typography sx={{ fontSize: 13, color: "#6B7280", mb: 2 }}>
        Review your loyalty program, then save the configuration to this experience.
      </Typography>

      <Box sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 2, background: "#F8F9FA" }}>
        <Typography sx={{ fontWeight: 700, fontSize: 15, mb: 1 }}>
          {form.earningRules.length} earning rule{form.earningRules.length === 1 ? "" : "s"} ·{" "}
          {form.rewards.length} reward{form.rewards.length === 1 ? "" : "s"} ·{" "}
          {form.membershipTiers.length} tier{form.membershipTiers.length === 1 ? "" : "s"}
        </Typography>
        {form.rewards.map((reward, idx) => (
          <Typography key={reward.id} sx={{ fontSize: 13, color: "#374151" }}>
            {idx + 1}. {reward.rewardLabel || `Reward ${idx + 1}`}{" "}
            <Typography component="span" sx={{ fontSize: 12, color: "#6B7280" }}>
              ({reward.pointCost} pts ·{" "}
              {reward.inventoryMode === "unlimited"
                ? "Unlimited"
                : `${reward.totalQuantity} available`}
              )
            </Typography>
          </Typography>
        ))}
      </Box>

    </Box>
  );

  const renderStep = () => {
    if (activeStep === 0) return renderRulesStep();
    if (activeStep === 1) return renderRewardsStep();
    if (activeStep === 2) return renderTiersStep();
    return renderReviewStep();
  };

  return (
    <EngagementConfigShell
      title="Configure Loyalty & Rewards"
      subtitle="Build a point-based loyalty program that rewards repeat attendance and engagement."
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

export default LoyaltyConfig;
