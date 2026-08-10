import React, { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  CircularProgress,
} from "@mui/material";
import CasinoOutlinedIcon from "@mui/icons-material/CasinoOutlined";

const ACCENT = "#F09925";

/**
 * DrawingControls — Manual draw button with confirmation dialog.
 * Triggers a raffle drawing when confirmed.
 *
 * @param {object} props
 * @param {function} props.onTriggerDraw - Async callback to trigger the drawing
 * @param {boolean} [props.disabled] - Whether the button is disabled
 * @param {number} [props.totalEntries] - Total entries in pool (shown in confirmation)
 */
const DrawingControls = ({ onTriggerDraw, disabled = false, totalEntries = 0 }) => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [error, setError] = useState(null);

  const handleDraw = async () => {
    setDrawing(true);
    setError(null);
    try {
      await onTriggerDraw();
      setConfirmOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Drawing failed");
    } finally {
      setDrawing(false);
    }
  };

  return (
    <Box>
      <Button
        variant="contained"
        startIcon={<CasinoOutlinedIcon />}
        onClick={() => setConfirmOpen(true)}
        disabled={disabled || totalEntries === 0}
        sx={{
          background: ACCENT,
          textTransform: "none",
          fontWeight: 700,
          borderRadius: 2,
          px: 3,
          py: 1.2,
          fontSize: 14,
          "&:hover": { background: "#D4820F" },
          "&:disabled": { background: "#E0E0E0", color: "#9E9E9E" },
        }}
      >
        Trigger Manual Draw
      </Button>

      <Dialog
        open={confirmOpen}
        onClose={() => !drawing && setConfirmOpen(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: 18, pb: 1 }}>
          Confirm Manual Drawing
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ color: "#71727A", fontSize: 14, mb: 1 }}>
            This will immediately select winner(s) from the current entry pool.
          </Typography>
          <Typography sx={{ fontWeight: 600, fontSize: 14, color: "#1D1B20" }}>
            Eligible entries: {totalEntries}
          </Typography>
          {error && (
            <Typography sx={{ color: "#D32F2F", fontSize: 13, mt: 1.5 }}>
              {error}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            onClick={() => setConfirmOpen(false)}
            disabled={drawing}
            sx={{ textTransform: "none", color: "#71727A", fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleDraw}
            disabled={drawing}
            startIcon={drawing ? <CircularProgress size={16} sx={{ color: "#fff" }} /> : <CasinoOutlinedIcon />}
            sx={{
              background: ACCENT,
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 2,
              "&:hover": { background: "#D4820F" },
            }}
          >
            {drawing ? "Drawing..." : "Draw Now"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DrawingControls;
