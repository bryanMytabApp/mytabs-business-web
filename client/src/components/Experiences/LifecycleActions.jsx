import React from "react";
import { Box, Button } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import StopIcon from "@mui/icons-material/Stop";
import SettingsIcon from "@mui/icons-material/Settings";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

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
    Closed: [
    { label: "Reset to Draft", action: "reset", icon: RestartAltIcon, variant: "configure" },
  ],
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
    background: "rgba(34,197,94,0.08)",
    border: "1.5px solid rgba(34,197,94,0.25)",
    color: "#16a34a",
    "&:hover": {
      background: "rgba(34,197,94,0.14)",
      borderColor: "rgba(34,197,94,0.4)",
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
const LifecycleActions = ({ state, onAction, onPreview, disabled = false, drawState }) => {
  const actions = (STATE_ACTIONS[state] || []).filter(a => {
    // Hide reopen if a draw was already executed
    if ((a.action === 'reopen' || a.action === 'reset') && drawState && drawState !== 'OPEN') return false;
    return true;
  });

  if (actions.length === 0 && !onPreview) return null;

  const primaryActions = actions.filter(a => a.variant !== 'golive');
  const activateAction = actions.find(a => a.variant === 'golive');

  return (
    <Box sx={{ display: "flex", gap: 1, width: "100%" }}>
      {primaryActions.map(({ label, action, icon: Icon, variant }) => {
        const style = BUTTON_STYLES[variant] || BUTTON_STYLES.configure;
        return (
          <Button
            key={action}
            size="small"
            disabled={disabled}
            onClick={() => onAction && onAction(action)}
            title={label}
            sx={{
              flex: 1,
              minWidth: 0,
              textTransform: "none",
              fontWeight: 800,
              fontSize: 14.5,
              fontFamily: "'Nunito', sans-serif",
              borderRadius: "12px",
              px: 1.5,
              py: 1,
              minHeight: 40,
              ...style,
              "&:disabled": {
                opacity: 0.5,
                boxShadow: "none",
              },
            }}
          >
            <Icon sx={{ fontSize: 20 }} />
          </Button>
        );
      })}
      {onPreview && (
        <Button
          size="small"
          disabled={disabled}
          onClick={onPreview}
          title="Preview"
          sx={{
            flex: 1,
            minWidth: 0,
            textTransform: "none",
            fontWeight: 800,
            fontSize: 14.5,
            fontFamily: "'Nunito', sans-serif",
            borderRadius: "12px",
            px: 1.5,
            py: 1,
            minHeight: 40,
            ...BUTTON_STYLES.preview,
            "&:disabled": {
              opacity: 0.5,
            },
          }}
        >
          <OpenInNewIcon sx={{ fontSize: 20 }} />
        </Button>
      )}
      {activateAction && (() => {
        const { label, action, icon: Icon, variant } = activateAction;
        const style = BUTTON_STYLES[variant] || BUTTON_STYLES.configure;
        return (
          <Button
            key={action}
            size="small"
            disabled={disabled}
            onClick={() => onAction && onAction(action)}
            title={label}
            sx={{
              flex: 1,
              minWidth: 0,
              textTransform: "none",
              fontWeight: 800,
              fontSize: 14.5,
              fontFamily: "'Nunito', sans-serif",
              borderRadius: "12px",
              px: 1.5,
              py: 1,
              minHeight: 40,
              ...style,
              "&:disabled": {
                opacity: 0.5,
                boxShadow: "none",
              },
            }}
          >
            <Icon sx={{ fontSize: 20 }} />
          </Button>
        );
      })()}
    </Box>
  );
};

export default LifecycleActions;
