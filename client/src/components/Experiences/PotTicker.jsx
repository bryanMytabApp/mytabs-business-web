import React, { useState, useEffect, useRef } from "react";
import { Box, Typography } from "@mui/material";
import MonetizationOnOutlinedIcon from "@mui/icons-material/MonetizationOnOutlined";

const ACCENT = "#F09925";

/**
 * PotTicker — Animated number counter showing the current jackpot amount.
 * Used for 50/50 and Progressive raffle types.
 *
 * @param {object} props
 * @param {number} props.amount - Current pot amount in cents
 * @param {string} [props.label] - Label text (e.g. "Current Jackpot")
 * @param {string} [props.currency] - Currency code (default "USD")
 */
const PotTicker = ({ amount = 0, label = "Current Jackpot", currency = "USD" }) => {
  const [displayAmount, setDisplayAmount] = useState(amount);
  const animationRef = useRef(null);
  const previousAmountRef = useRef(amount);

  useEffect(() => {
    const prev = previousAmountRef.current;
    const target = amount;
    previousAmountRef.current = amount;

    if (prev === target) return;

    const duration = 800; // ms
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(prev + (target - prev) * eased);
      setDisplayAmount(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [amount]);

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(displayAmount / 100);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        p: 2.5,
        borderRadius: 3,
        background: `linear-gradient(135deg, ${ACCENT}08 0%, ${ACCENT}14 100%)`,
        border: `1px solid ${ACCENT}30`,
      }}
    >
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: `${ACCENT}20`,
        }}
      >
        <MonetizationOnOutlinedIcon sx={{ color: ACCENT, fontSize: 28 }} />
      </Box>
      <Box>
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#71727A", textTransform: "uppercase", letterSpacing: 0.5 }}>
          {label}
        </Typography>
        <Typography
          sx={{
            fontSize: 32,
            fontWeight: 800,
            color: "#1D1B20",
            lineHeight: 1.2,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formattedAmount}
        </Typography>
      </Box>
    </Box>
  );
};

export default PotTicker;
