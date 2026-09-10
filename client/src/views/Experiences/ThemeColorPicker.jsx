import React from "react";
import { Box, Typography } from "@mui/material";

// Shared preset palette (mirrors RaffleConfig's Theme Color swatches) so every
// engagement offers the same quick-pick colors plus a custom picker.
export const THEME_PRESETS = [
  { name: "Tabs Cyan", value: "#00A9D6" },
  { name: "Ocean Blue", value: "#3B82F6" },
  { name: "Ember", value: "#F47A20" },
  { name: "Grape", value: "#8B5CF6" },
  { name: "Rose", value: "#EC4899" },
  { name: "Emerald", value: "#10B981" },
  { name: "Slate", value: "#0D1B2A" },
];

/**
 * ThemeColorPicker — reusable accent-color control for engagement config forms.
 *
 * Mirrors the RaffleConfig "Theme Color" section: a row of preset swatches plus
 * a native custom color input. The selected value is a hex string persisted as
 * `config.accentColor` and applied as the engagement's theme color on the
 * attendee/preview screen.
 *
 * Props:
 *  - value: current hex color (string)
 *  - onChange: (hex: string) => void
 *  - label: section heading (default "Theme Color")
 *  - helper: sub-caption text
 */
export default function ThemeColorPicker({
  value,
  onChange,
  label = "Theme Color",
  helper = "Accent color used across this engagement's display",
}) {
  const color = value || "#00A9D6";
  return (
    <Box
      sx={{ mb: 2, p: 2, border: "1px solid #E5E7EB", borderRadius: 3, background: "#fff" }}
      data-testid="theme-color-picker"
    >
      <Typography sx={{ fontSize: 13, fontWeight: 700, mb: 0.5, color: "#111827" }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 12, color: "#6B7280", mb: 1.5 }}>{helper}</Typography>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, flexWrap: "wrap" }}>
        {THEME_PRESETS.map((c) => {
          const selected = String(color).toLowerCase() === c.value.toLowerCase();
          return (
            <Box
              key={c.value}
              role="button"
              aria-label={c.name}
              aria-pressed={selected}
              title={c.name}
              onClick={() => onChange(c.value)}
              data-testid={`theme-swatch-${c.value.replace("#", "")}`}
              sx={{
                width: 30,
                height: 30,
                borderRadius: "50%",
                background: c.value,
                cursor: "pointer",
                boxShadow: selected
                  ? `0 0 0 3px #fff, 0 0 0 5px ${c.value}`
                  : "0 0 0 1px rgba(0,0,0,0.1)",
                transition: "box-shadow 0.15s",
              }}
            />
          );
        })}
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: 30,
            height: 30,
            border: "none",
            borderRadius: "50%",
            padding: 0,
            cursor: "pointer",
            background: "none",
          }}
          title="Custom color"
          aria-label="Custom theme color"
          data-testid="theme-color-custom"
        />
        <Typography sx={{ fontSize: 12, color: "#6B7280", ml: 0.5 }}>{color}</Typography>
      </Box>
    </Box>
  );
}
