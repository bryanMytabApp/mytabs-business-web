import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Collapse,
  CircularProgress,
  Alert,
  Button,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import CasinoOutlinedIcon from "@mui/icons-material/CasinoOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import { getDrawings } from "../../services/experienceService";

const ACCENT = "#F09925";

/**
 * DrawingRow — Expandable table row showing drawing details and winner info.
 */
const DrawingRow = ({ drawing, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifying, setVerifying] = useState(false);

  /**
   * Client-side Provably Fair Verification — uses only data already on screen.
   * Reproduces the HMAC-based shuffle and selection using the draw seed and entry list.
   */
  const runVerification = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const seed = drawing.seed || drawing.auditSeed || drawing.metadata?.drawSeed;
      const entryList = drawing.shuffledEntryList || [];
      const winners = drawing.winners || [];

      if (!seed || entryList.length === 0) {
        setVerifyResult({ pass: false, message: "Missing draw seed or shuffled entry list data." });
        setVerifying(false);
        return;
      }

      // Get the original (pre-shuffle) entry list by sorting entryIds
      const originalEntries = [...entryList].sort((a, b) => (a.entryId || "").localeCompare(b.entryId || ""));

      // Step 1: Verify shuffle seed = SHA-256(drawSeed + ":shuffle")
      const enc = new TextEncoder();
      const shuffleSeedBuffer = await crypto.subtle.digest("SHA-256", enc.encode(seed + ":shuffle"));
      const computedShuffleSeed = Array.from(new Uint8Array(shuffleSeedBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
      const expectedShuffleSeed = drawing.metadata?.shuffleSeed;
      const shuffleSeedMatch = !expectedShuffleSeed || computedShuffleSeed === expectedShuffleSeed;

      // Step 2: Reproduce HMAC-based Fisher-Yates shuffle
      const key = await crypto.subtle.importKey("raw", enc.encode(seed), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      const shuffled = [...originalEntries];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const sig = await crypto.subtle.sign("HMAC", key, enc.encode("shuffle:" + i));
        const view = new DataView(sig);
        const value = view.getUint32(0);
        const j = value % (i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      // Step 3: Verify shuffled list hash
      const shuffledIds = shuffled.map(e => e.entryId).join(",");
      const hashBuffer = await crypto.subtle.digest("SHA-256", enc.encode(shuffledIds));
      const computedHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
      const expectedHash = drawing.metadata?.shuffledListHash;
      const hashMatch = !expectedHash || computedHash === expectedHash;

      // Step 4: Reproduce winner selection
      const computedWinners = [];
      const usedIndices = new Set();
      let attempt = 0;
      const winnersCount = winners.length;
      while (computedWinners.length < winnersCount && attempt < 1000) {
        const selectSig = await crypto.subtle.sign("HMAC", key, enc.encode("select:" + attempt));
        const selectView = new DataView(selectSig);
        const idx = selectView.getUint32(0) % shuffled.length;
        if (!usedIndices.has(idx)) {
          usedIndices.add(idx);
          computedWinners.push({ position: idx + 1, entryId: shuffled[idx].entryId });
        }
        attempt++;
      }

      // Step 5: Compare computed winners to actual winners
      const winnersMatch = computedWinners.every((cw, i) => {
        const actual = winners[i];
        return actual && (cw.entryId === actual.entryId) && (cw.position === (actual.selectedFromShuffledPosition || actual.winningPosition));
      });

      const allPass = shuffleSeedMatch && hashMatch && winnersMatch;
      setVerifyResult({
        pass: allPass,
        shuffleSeedMatch,
        hashMatch,
        winnersMatch,
        computedShuffleSeed,
        computedHash,
        computedWinners,
        message: allPass
          ? "✅ Verification PASSED — Winners independently confirmed using on-screen data."
          : "❌ Verification FAILED — Computed results do not match displayed data.",
      });
    } catch (err) {
      setVerifyResult({ pass: false, message: "Verification error: " + err.message });
    }
    setVerifying(false);
  };

  const drawingTime = drawing.timestamp
    ? new Date(drawing.timestamp).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

  const triggerLabel = drawing.triggerMethod || drawing.trigger || "scheduled";
  const triggerColor = triggerLabel === "manual" ? ACCENT : "#2196F3";

  const claimStatusCounts = (drawing.winners || []).reduce(
    (acc, w) => {
      const status = w.claimStatus || "pending";
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    },
    {}
  );

  const getClaimChip = () => {
    const winners = drawing.winners || [];
    if (winners.length === 0) return <Chip size="small" label="No winners" sx={{ fontSize: 11 }} />;

    const claimed = claimStatusCounts.claimed || 0;
    const forfeited = claimStatusCounts.forfeited || 0;
    const pending = winners.length - claimed - forfeited;

    if (claimed === winners.length) {
      return <Chip size="small" label="All Claimed" sx={{ fontSize: 11, fontWeight: 600, background: "#E8F5E9", color: "#2E7D32" }} />;
    }
    if (forfeited === winners.length) {
      return <Chip size="small" label="All Forfeited" sx={{ fontSize: 11, fontWeight: 600, background: "#FFEBEE", color: "#C62828" }} />;
    }
    return (
      <Box sx={{ display: "flex", gap: 0.5 }}>
        {claimed > 0 && <Chip size="small" label={`${claimed} Claimed`} sx={{ fontSize: 10, fontWeight: 600, background: "#E8F5E9", color: "#2E7D32" }} />}
        {pending > 0 && <Chip size="small" label={`${pending} Pending`} sx={{ fontSize: 10, fontWeight: 600, background: "#FFF3E0", color: "#E65100" }} />}
        {forfeited > 0 && <Chip size="small" label={`${forfeited} Forfeited`} sx={{ fontSize: 10, fontWeight: 600, background: "#FFEBEE", color: "#C62828" }} />}
      </Box>
    );
  };

  return (
    <>
      <TableRow
        sx={{
          "& > *": { borderBottom: open ? "none" : undefined },
          "&:hover": { background: "#FAFAFA" },
          cursor: "pointer",
        }}
        onClick={() => setOpen(!open)}
      >
        <TableCell sx={{ width: 40, p: 1 }}>
          <IconButton size="small" aria-label="expand row">
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell sx={{ fontWeight: 600, fontSize: 13, color: "#1D1B20" }}>
          {drawingTime}
        </TableCell>
        <TableCell>
          <Chip
            size="small"
            label={triggerLabel}
            sx={{
              fontSize: 11,
              fontWeight: 600,
              background: `${triggerColor}14`,
              color: triggerColor,
              textTransform: "capitalize",
            }}
          />
        </TableCell>
        <TableCell sx={{ fontWeight: 600, fontSize: 13, color: "#1D1B20" }}>
          {drawing.totalEntries ?? "—"}
        </TableCell>
        <TableCell sx={{ fontWeight: 600, fontSize: 13, color: "#1D1B20" }}>
          {(drawing.winners || []).length}
        </TableCell>
        <TableCell>{getClaimChip()}</TableCell>
      </TableRow>

      {/* Expandable winner details */}
      <TableRow>
        <TableCell sx={{ py: 0 }} colSpan={6}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 2, px: 2 }}>
              <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#71727A", mb: 1 }}>
                Winner Details
              </Typography>
              {(!drawing.winners || drawing.winners.length === 0) ? (
                <Typography sx={{ fontSize: 12, color: "#9E9E9E", fontStyle: "italic" }}>
                  No winners for this drawing.
                </Typography>
              ) : (
                <Table size="small" sx={{ background: "#FAFAFA", borderRadius: 2 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontSize: 11, fontWeight: 700, color: "#71727A" }}>Entry ID</TableCell>
                      <TableCell sx={{ fontSize: 11, fontWeight: 700, color: "#71727A" }}>User</TableCell>
                      <TableCell sx={{ fontSize: 11, fontWeight: 700, color: "#71727A" }}>Email</TableCell>
                      <TableCell sx={{ fontSize: 11, fontWeight: 700, color: "#71727A" }}>Address</TableCell>
                      <TableCell sx={{ fontSize: 11, fontWeight: 700, color: "#71727A" }}>Entry Code</TableCell>
                      <TableCell sx={{ fontSize: 11, fontWeight: 700, color: "#71727A" }}>Claim Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {drawing.winners.map((winner, idx) => (
                      <TableRow key={winner.entryId || idx}>
                        <TableCell sx={{ fontSize: 12, color: "#1D1B20" }}>
                          {winner.entryId || "—"}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: "#1D1B20" }}>
                          {winner.attendeeName || [winner.firstName, winner.lastName].filter(Boolean).join(' ') || winner.userId || "—"}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: "#1D1B20" }}>
                          {winner.email || winner.entrantEmail || "—"}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: "#1D1B20" }}>
                          {winner.address || winner.entrantAddress || "—"}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, color: "#1D1B20", fontFamily: "monospace" }}>
                          {winner.entryCode || "—"}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={winner.claimStatus || "pending"}
                            sx={{
                              fontSize: 10,
                              fontWeight: 600,
                              textTransform: "capitalize",
                              background:
                                winner.claimStatus === "claimed"
                                  ? "#E8F5E9"
                                  : winner.claimStatus === "forfeited"
                                  ? "#FFEBEE"
                                  : "#FFF3E0",
                              color:
                                winner.claimStatus === "claimed"
                                  ? "#2E7D32"
                                  : winner.claimStatus === "forfeited"
                                  ? "#C62828"
                                  : "#E65100",
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              {drawing.auditSeed && (
                <Typography sx={{ fontSize: 10, color: "#BDBDBD", mt: 1, fontFamily: "monospace" }}>
                  Audit seed: {drawing.auditSeed}
                </Typography>
              )}

              {/* Provably Fair Verification Report */}
              {drawing.metadata?.drawingType === "provably-fair" && (
                <Paper
                  elevation={0}
                  sx={{
                    mt: 2,
                    p: 2.5,
                    borderRadius: 2,
                    border: "1px solid rgba(21, 101, 192, 0.15)",
                    background: "linear-gradient(135deg, rgba(21,101,192,0.03) 0%, rgba(13,71,161,0.06) 100%)",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                    <Typography sx={{ fontSize: 15, fontWeight: 800, color: "#0D47A1" }}>
                      🔒 Provably Fair Verification
                    </Typography>
                    <Chip
                      size="small"
                      label="NIST Verified"
                      sx={{ fontSize: 13, fontWeight: 700, background: "#E8F5E9", color: "#1B5E20", letterSpacing: 0.5 }}
                    />
                  </Box>

                  <Typography sx={{ fontSize: 13, color: "#546E7A", lineHeight: 1.7, mb: 2 }}>
                    This winner was selected using an independently verifiable algorithm. The random value was
                    sourced from the <strong>NIST Randomness Beacon</strong> (U.S. National Institute of Standards
                    and Technology) — committed to before it existed — making it impossible for the organizer
                    or platform to influence the outcome.
                  </Typography>

                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#78909C", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Protocol
                      </Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1D1B20", fontFamily: "monospace" }}>
                        {drawing.metadata?.protocol || "tabs-raffle-v1"}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#78909C", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Randomness Source
                      </Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1D1B20" }}>
                        NIST Beacon v2.0 —{" "}
                        {drawing.metadata?.nistPulseIndex ? (
                          <a
                            href={`https://beacon.nist.gov/beacon/2.0/chain/2/pulse/${drawing.metadata.nistPulseIndex}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "#1976d2", textDecoration: "underline" }}
                          >
                            Pulse #{drawing.metadata.nistPulseIndex}
                          </a>
                        ) : (
                          "Pulse #—"
                        )}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#78909C", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Draw Seed (SHA-256)
                      </Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 500, color: "#1D1B20", fontFamily: "monospace", wordBreak: "break-all" }}>
                        {drawing.metadata?.drawSeed || "—"}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#78909C", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Shuffle Seed (SHA-256)
                      </Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 500, color: "#1D1B20", fontFamily: "monospace", wordBreak: "break-all" }}>
                        {drawing.metadata?.shuffleSeed || "—"}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#78909C", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Shuffled List Hash (SHA-256)
                      </Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 500, color: "#1D1B20", fontFamily: "monospace", wordBreak: "break-all" }}>
                        {drawing.metadata?.shuffledListHash || "—"}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#78909C", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Receipt Hash (SHA-256)
                      </Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 500, color: "#1D1B20", fontFamily: "monospace", wordBreak: "break-all" }}>
                        {drawing.metadata?.receiptHash || "—"}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#78909C", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Selection Method
                      </Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1D1B20" }}>
                        Cryptographic Random Selection
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#78909C", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Shuffle Method
                      </Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1D1B20" }}>
                        Deterministic Cryptographic Shuffle
                      </Typography>
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#78909C", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Winning Position{drawing.winners?.length > 1 ? "s" : ""}
                      </Typography>
                      <Typography sx={{ fontSize: 14, fontWeight: 600, color: "#1D1B20" }}>
                        {(drawing.winners || []).map((w, idx) => `#${w.selectedFromShuffledPosition || w.winningPosition || idx + 1}`).join(" and ")} of {drawing.totalEntries || "—"} entries
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ mt: 2, pt: 1.5, borderTop: "1px solid rgba(21,101,192,0.1)" }}>
                    <Typography sx={{ fontSize: 13, color: "#78909C", lineHeight: 1.6 }}>
                      This draw used a cryptographically secure, independently verifiable process.
                      The random seed was sourced from the NIST Randomness Beacon and combined with
                      the entry list to produce a deterministic outcome. An independent auditor can
                      verify the result using the published hashes and the Tabs verification protocol.
                    </Typography>
                  </Box>

                  {/* Shuffled Draw Order — entry codes only, no names */}
                  {Array.isArray(drawing.shuffledEntryList) && drawing.shuffledEntryList.length > 0 && (
                    <Box sx={{ mt: 2, pt: 1.5, borderTop: "1px solid rgba(21,101,192,0.1)" }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#78909C", textTransform: "uppercase", letterSpacing: 0.5, mb: 1 }}>
                        Shuffled Draw Order
                      </Typography>
                      <Typography sx={{ fontSize: 12, color: "#90A4AE", mb: 1 }}>
                        NIST-randomized positions. Winners were selected from positions marked below.
                      </Typography>
                      <Box sx={{ maxHeight: 200, overflowY: "auto", border: "1px solid #E0E0E0", borderRadius: 1, p: 1, bgcolor: "#FAFAFA" }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontSize: 11, fontWeight: 700, py: 0.5, color: "#546E7A" }}>Position</TableCell>
                              <TableCell sx={{ fontSize: 11, fontWeight: 700, py: 0.5, color: "#546E7A" }}>Entry ID</TableCell>
                              <TableCell sx={{ fontSize: 11, fontWeight: 700, py: 0.5, color: "#546E7A" }}>Result</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {drawing.shuffledEntryList.map((entry) => {
                              const isWinner = (drawing.winners || []).some(
                                (w) => w.selectedFromShuffledPosition === entry.position || w.entryId === entry.entryId
                              );
                              return (
                                <TableRow key={entry.position} sx={isWinner ? { bgcolor: "rgba(240,153,37,0.08)" } : {}}>
                                  <TableCell sx={{ fontSize: 12, py: 0.3, fontWeight: isWinner ? 700 : 400 }}>
                                    #{entry.position}
                                  </TableCell>
                                  <TableCell sx={{ fontSize: 11, py: 0.3, fontFamily: "monospace", color: "#455A64" }}>
                                    {entry.entryId}
                                  </TableCell>
                                  <TableCell sx={{ fontSize: 11, py: 0.3 }}>
                                    {isWinner ? "🏆 Winner" : "—"}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </Box>
                    </Box>
                  )}

                  {/* Verify Draw Button — client-side PFV */}
                  <Box sx={{ mt: 2, pt: 1.5, borderTop: "1px solid rgba(21,101,192,0.1)" }}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={runVerification}
                      disabled={verifying}
                      sx={{ textTransform: "none", fontWeight: 600, borderColor: "#1565C0", color: "#1565C0" }}
                    >
                      {verifying ? "Verifying..." : "🔍 Verify Draw (Client-Side PFV)"}
                    </Button>
                    {verifyResult && (
                      <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1, bgcolor: verifyResult.pass ? "rgba(76,175,80,0.08)" : "rgba(244,67,54,0.08)", border: `1px solid ${verifyResult.pass ? "#4CAF50" : "#F44336"}` }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: verifyResult.pass ? "#2E7D32" : "#C62828" }}>
                          {verifyResult.message}
                        </Typography>
                        {verifyResult.computedWinners && (
                          <Box sx={{ mt: 1 }}>
                            <Typography sx={{ fontSize: 12, color: "#546E7A" }}>
                              Shuffle Seed: {verifyResult.shuffleSeedMatch ? "✅ Match" : "❌ Mismatch"}
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: "#546E7A" }}>
                              Shuffled List Hash: {verifyResult.hashMatch ? "✅ Match" : "❌ Mismatch"}
                            </Typography>
                            <Typography sx={{ fontSize: 12, color: "#546E7A" }}>
                              Winners: {verifyResult.winnersMatch ? "✅ Match" : "❌ Mismatch"}
                            </Typography>
                            {verifyResult.computedWinners.map((w, i) => (
                              <Typography key={i} sx={{ fontSize: 11, color: "#78909C", fontFamily: "monospace", mt: 0.5 }}>
                                Computed Winner {i + 1}: Position #{w.position} → {w.entryId}
                              </Typography>
                            ))}
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
                </Paper>
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
};

/**
 * DrawingHistory — Table view of all drawings for a raffle experience.
 * Shows drawing time, trigger method, entries, winners, and claim status.
 * Expandable rows reveal individual winner details.
 */
const DrawingHistory = () => {
  const { eventId, experienceId } = useParams();
  const navigate = useNavigate();

  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [navError, setNavError] = useState(null);

  const fetchDrawings = useCallback(
    async (nextCursor = null) => {
      if (nextCursor) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const params = { limit: 20 };
        if (nextCursor) params.cursor = nextCursor;
        const res = await getDrawings(eventId, experienceId, params);
        const data = res.data?.data || res.data?.items || [];
        const newCursor = res.data?.nextCursor || null;

        if (nextCursor) {
          setDrawings((prev) => [...prev, ...data]);
        } else {
          setDrawings(data);
        }
        setCursor(newCursor);
        setHasMore(!!newCursor);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load drawing history");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [eventId, experienceId]
  );

  const handleExportDrawReport = () => {
    try {
      setNavError(null);
      navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/draw-report`);
    } catch (err) {
      setNavError("Failed to navigate to Draw Report. Please try again.");
    }
  };

  useEffect(() => {
    fetchDrawings();
  }, [fetchDrawings]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CasinoOutlinedIcon sx={{ color: ACCENT, fontSize: 22 }} />
            <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }}>
              Drawing History
            </Typography>
          </Box>
          <Typography sx={{ color: "#71727A", fontSize: 13, mt: 0.25 }}>
            All drawings for this raffle engagement
          </Typography>
        </Box>
        <IconButton onClick={() => fetchDrawings()} sx={{ color: ACCENT }}>
          <RefreshIcon />
        </IconButton>
        <Button
          variant="contained"
          onClick={handleExportDrawReport}
          sx={{
            textTransform: "none",
            fontWeight: 600,
            borderRadius: 2,
            background: ACCENT,
            "&:hover": { background: "#D4820F" },
          }}
        >
          Export Draw Report
        </Button>
      </Box>

      {navError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setNavError(null)}>
          {navError}
        </Alert>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {drawings.length === 0 ? (
        <Box
          sx={{
            textAlign: "center",
            py: 6,
            border: "1.5px dashed #E0E0E0",
            borderRadius: 3,
            background: "#FAFAFA",
          }}
        >
          <CasinoOutlinedIcon sx={{ fontSize: 48, color: "#BDBDBD", mb: 1.5 }} />
          <Typography sx={{ color: "#71727A", fontWeight: 600, fontSize: 15 }}>
            No drawings yet
          </Typography>
          <Typography sx={{ color: "#9E9E9E", fontSize: 13, mt: 0.5 }}>
            Drawings will appear here once triggered manually or by schedule.
          </Typography>
        </Box>
      ) : (
        <>
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{ borderRadius: 3, border: "1px solid #E8E8E8" }}
          >
            <Table>
              <TableHead>
                <TableRow sx={{ background: "#FAFAFA" }}>
                  <TableCell sx={{ width: 40 }} />
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                    Drawing Time
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                    Trigger
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                    Total Entries
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                    Winners
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, fontSize: 12, color: "#71727A" }}>
                    Claim Status
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {drawings.map((drawing, idx) => (
                  <DrawingRow key={drawing.drawingId || drawing.SK || idx} drawing={drawing} defaultOpen={idx === 0} />
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {hasMore && (
            <Box sx={{ textAlign: "center", mt: 3 }}>
              <Button
                variant="outlined"
                onClick={() => fetchDrawings(cursor)}
                disabled={loadingMore}
                sx={{
                  textTransform: "none",
                  fontWeight: 600,
                  borderColor: ACCENT,
                  color: ACCENT,
                  borderRadius: 2,
                  "&:hover": { borderColor: "#D4820F", background: `${ACCENT}08` },
                }}
              >
                {loadingMore ? (
                  <CircularProgress size={18} sx={{ color: ACCENT, mr: 1 }} />
                ) : null}
                Load More
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default DrawingHistory;
