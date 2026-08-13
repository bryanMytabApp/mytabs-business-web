import React from "react";
import { Box, Button } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import StopIcon from "@mui/icons-material/Stop";
import SettingsIcon from "@mui/icons-material/Settings";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

/**
 * Map lifecycle states to available quick actions.
 * Each action has: label, action key, icon, variant style, and optional gradient.
 */
const STATE_ACTIONS = {
  Draft: [
    { label: "Configure", action: "configure", icon: SettingsIcon, variant: "configure" },
    { label: "Go Live", action: "activate", icon: PlayArrowIcon, variant: "golive" },
  ],
  Scheduled: [
    { label: "Configure", action: "configure", icon: SettingsIcon, variant: "configure" },
    { label: "Activate", action: "activate", icon: PlayArrowIcon, variant: "golive" },
  ],
  Live: [
    { label: "Pause", action: "pause", icon: PauseIcon, variant: "configure" },
    { label: "Close", action: "close", icon: StopIcon, variant: "close" },
  ],
  Paused: [
    { label: "Resume", action: "resume", icon: PlayArrowIcon, variant: "golive" },
  ],
  Closed: [],
  Analytics: [],
};

/**
 * Button style presets matching the polished admin card design.
 */
const BUTTON_STYLES = {
  configure: {
    background: "#ffffff",
    border: "1.5px solid #e3e7eb",
    color: "#4b5563",
    "&:hover": {
      background: "#f8fafb",
      borderColor: "#d5dbe1",
    },
  },
  golive: {
    background: "linear-gradient(135deg, #34c471, #1f9d55)",
    border: "none",
    color: "#fff",
    boxShadow: "0 8px 18px -6px rgba(31,157,85,0.5)",
    "&:hover": {
      background: "linear-gradient(135deg, #3dd47d, #22ad5f)",
      boxShadow: "0 10px 22px -6px rgba(31,157,85,0.6)",
    },
  },
  close: {
    background: "#ffffff",
    border: "1.5px solid #fecaca",
    color: "#dc2626",
    "&:hover": {
      background: "#fef2f2",
      borderColor: "#f87171",
    },
  },
  preview: {
    background: "rgba(0,169,214,0.08)",
    border: "1.5px solid rgba(0,169,214,0.25)",
    color: "#007a9e",
    "&:hover": {
      background: "rgba(0,169,214,0.14)",
      borderColor: "rgba(0,169,214,0.4)",
    },
  },
};

/**
 * LifecycleActions — renders action buttons based on the instance's current state.
 * Styled to match the polished admin card design with gradient Go Live button,
 * outlined Configure/Close, and accent-tinted Preview.
 *
 * Props:
 * - state: string (Draft | Scheduled | Live | Paused | Closed | Analytics)
 * - onAction: (action: string) => void
 * - onPreview: () => void (optional — renders Preview button if provided)
 * - disabled: boolean (optional)
 */
const LifecycleActions = ({ state, onAction, onPreview, disabled = false }) => {
  const actions = STATE_ACTIONS[state] || [];

  if (actions.length === 0 && !onPreview) return null;

  return (
    <Box sx={{ display: "flex", gap: 1.25, flexWrap: "wrap", width: "100%" }}>
      {actions.map(({ label, action, icon: Icon, variant }) => {
        const style = BUTTON_STYLES[variant] || BUTTON_STYLES.configure;
        return (
          <Button
            key={action}
            size="small"
            disabled={disabled}
            startIcon={<Icon sx={{ fontSize: 16 }} />}
            onClick={() => onAction && onAction(action)}
            sx={{
              flex: 1,
              minWidth: 120,
              textTransform: "none",
              fontWeight: 800,
              fontSize: 14.5,
              fontFamily: "'Nunito', sans-serif",
              borderRadius: "13px",
              px: 2,
              py: 1.4,
              minHeight: 44,
              ...style,
              "&:disabled": {
                opacity: 0.5,
                boxShadow: "none",
              },
            }}
          >
            {label}
          </Button>
        );
      })}
      {onPreview && (
        <Button
          size="small"
          disabled={disabled}
          endIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />}
          onClick={onPreview}
          sx={{
            flex: 1,
            minWidth: 120,
            textTransform: "none",
            fontWeight: 800,
            fontSize: 14.5,
            fontFamily: "'Nunito', sans-serif",
            borderRadius: "13px",
            px: 2,
            py: 1.4,
            minHeight: 44,
            ...BUTTON_STYLES.preview,
            "&:disabled": {
              opacity: 0.5,
            },
          }}
        >
          Preview
        </Button>
      )}
    </Box>
  );
};

export default LifecycleActions;
