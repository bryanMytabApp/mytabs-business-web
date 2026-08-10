import React from "react";
import { Box, Typography, Chip } from "@mui/material";
import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import CasinoOutlinedIcon from "@mui/icons-material/CasinoOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import StopCircleOutlinedIcon from "@mui/icons-material/StopCircleOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";

const ACCENT = "#F09925";

const EVENT_CONFIG = {
  entry: {
    icon: PersonAddOutlinedIcon,
    color: "#4CAF50",
    label: "New Entry",
  },
  drawing: {
    icon: CasinoOutlinedIcon,
    color: ACCENT,
    label: "Drawing",
  },
  winner: {
    icon: EmojiEventsOutlinedIcon,
    color: "#7C4DFF",
    label: "Winner Selected",
  },
  activated: {
    icon: PlayCircleOutlineIcon,
    color: "#4CAF50",
    label: "Activated",
  },
  paused: {
    icon: PauseCircleOutlineIcon,
    color: "#FF9800",
    label: "Paused",
  },
  closed: {
    icon: StopCircleOutlinedIcon,
    color: "#F44336",
    label: "Closed",
  },
  invalidated: {
    icon: BlockOutlinedIcon,
    color: "#F44336",
    label: "Entry Invalidated",
  },
};

/**
 * TimelineEvent — A single event item in the activity timeline feed.
 *
 * @param {object} props
 * @param {string} props.type - Event type (entry, drawing, winner, activated, paused, closed, invalidated)
 * @param {string} props.message - Description text
 * @param {string} props.timestamp - ISO timestamp
 * @param {object} [props.metadata] - Additional metadata to display
 * @param {boolean} [props.isLast] - Whether this is the last item (hides bottom connector)
 */
const TimelineEvent = ({ type, message, timestamp, metadata, isLast = false }) => {
  const config = EVENT_CONFIG[type] || EVENT_CONFIG.entry;
  const Icon = config.icon;

  const formattedTime = timestamp
    ? new Date(timestamp).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

  return (
    <Box sx={{ display: "flex", gap: 1.5, position: "relative" }}>
      {/* Timeline connector */}
      {!isLast && (
        <Box
          sx={{
            position: "absolute",
            left: 15,
            top: 32,
            bottom: -8,
            width: 2,
            background: "#E8E8E8",
          }}
        />
      )}

      {/* Icon */}
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `${config.color}14`,
          flexShrink: 0,
          zIndex: 1,
        }}
      >
        <Icon sx={{ color: config.color, fontSize: 16 }} />
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, pb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}>
          <Chip
            size="small"
            label={config.label}
            sx={{
              fontSize: 10,
              fontWeight: 600,
              height: 20,
              background: `${config.color}14`,
              color: config.color,
            }}
          />
          <Typography sx={{ fontSize: 11, color: "#9E9E9E" }}>
            {formattedTime}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 13, color: "#1D1B20", fontWeight: 500 }}>
          {message}
        </Typography>
        {metadata && (
          <Typography sx={{ fontSize: 11, color: "#71727A", mt: 0.25 }}>
            {Object.entries(metadata)
              .map(([key, val]) => `${key}: ${val}`)
              .join(" · ")}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default TimelineEvent;
