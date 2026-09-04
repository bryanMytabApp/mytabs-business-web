// Feature: tabs-homepage-redesign
//
// productIcons — the single source of truth for per-product icons used across
// the Marketing_Site (Products mega-menu AND the bespoke Product_Pages).
//
// Each entry is keyed by product slug and provides:
//   - `gradient`: a CSS background gradient (mapped to the palette custom props)
//   - `render`:   the inner SVG element(s) drawn on a `0 0 24 24` canvas
//
// Keeping this in one module means the nav icon and the large Product_Page
// title icon never drift apart.

import React from "react";

// Per-product icon (gradient + SVG path data), keyed by slug. `render` holds
// the inner SVG element(s); the consuming component supplies the <svg> wrapper
// so it can size/style the icon for its context (small chip vs. large title).
export const PRODUCT_ICONS = {
  events: {
    gradient: "linear-gradient(135deg, var(--cyan), var(--teal))",
    render: (
      <>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <path d="M3 10h18" />
      </>
    ),
  },
  ticketing: {
    gradient: "linear-gradient(135deg, var(--orange), var(--amber))",
    render: <path d="M3 6h18l-2 13H5L3 6z" />,
  },
  analytics: {
    gradient: "linear-gradient(135deg, var(--teal), var(--ink))",
    render: <path d="M4 4h4v16H4zM10 10h4v10h-4zM16 6h4v14h-4z" />,
  },
  engagements: {
    gradient: "linear-gradient(135deg, var(--amber), var(--orange))",
    render: <path d="M12 2l2.5 6.5L21 11l-6.5 2.5L12 20l-2.5-6.5L3 11l6.5-2.5L12 2z" />,
  },
  "market-intelligence": {
    gradient: "linear-gradient(135deg, var(--cyan), var(--ink))",
    render: <path d="M3 3v18h18M7 15l4-5 3 3 5-7" />,
  },
  "ai-discovery": {
    gradient: "linear-gradient(135deg, var(--orange), var(--teal))",
    render: (
      <>
        <rect x="4" y="8" width="16" height="12" rx="2" />
        <path d="M9 8V6a3 3 0 016 0v2" />
      </>
    ),
  },
  organizations: {
    gradient: "linear-gradient(135deg, var(--ink), var(--teal))",
    render: (
      <>
        <path d="M3 21h18M6 21V8l6-4 6 4v13" />
        <path d="M10 21v-5h4v5" />
      </>
    ),
  },
};

export default PRODUCT_ICONS;
