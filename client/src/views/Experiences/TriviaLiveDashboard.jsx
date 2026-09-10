import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Button,
  LinearProgress,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import EmojiEventsOutlinedIcon from "@mui/icons-material/EmojiEventsOutlined";
import { getLiveStats, setQuestionState } from "../../services/experienceService";

const ACCENT = "#22C55E"; // Games & Challenges brand color
const REFRESH_INTERVAL = 2000; // 2 seconds (Requirement 9.3)

// Per-question state chip styling.
const STATE_CHIP = {
  pending: { label: "PENDING", bg: "#F3F4F6", color: "#6B7280" },
  active: { label: "ACTIVE", bg: "#E8F5E9", color: "#2E7D32" },
  locked: { label: "LOCKED", bg: "#FEF3C7", color: "#B45309" },
  revealed: { label: "REVEALED", bg: "#DBEAFE", color: "#1D4ED8" },
};

// Normalize the leaderboard, which the plugin returns as { entries: [...] } but
// which we tolerate as a bare array too.
function leaderboardEntries(leaderboard) {
  if (!leaderboard) return [];
  if (Array.isArray(leaderboard)) return leaderboard;
  return Array.isArray(leaderboard.entries) ? leaderboard.entries : [];
}

/**
 * QuestionCard — one card per question: prompt, state chip, host controls
 * (reveal / lock / reveal-answer), a countdown bar while active, an
 * answer-distribution section (a proportional bar per option with count +
 * percentage), and the correct-option highlight on reveal. Memoized so
 * refreshing one question's data does not re-render the others.
 */
const QuestionCard = React.memo(
  ({ question, distribution, now, isLive, anyActive, busy, onReveal, onLock, onRevealAnswer }) => {
    const state = question.questionState || "pending";
    const chip = STATE_CHIP[state] || STATE_CHIP.pending;
    const options = distribution?.options || question.options || [];
    const totalAnswers = distribution?.totalAnswers || 0;
    const zeroAnswers = totalAnswers === 0;
    const isRevealed = state === "revealed";

    // Controls (Requirement 9.4–9.6).
    const canReveal = isLive && state === "pending" && !anyActive;
    const canLock = state === "active";
    const canRevealAnswer = state === "locked";

    // Countdown (Requirement 9.2): remaining = max(0, timeLimit - (now - revealedAt)/1000).
    let remaining = null;
    let pctRemaining = 0;
    if (state === "active" && question.revealedAt) {
      const revealedMs = new Date(question.revealedAt).getTime();
      const elapsed = (now - revealedMs) / 1000;
      remaining = Math.max(0, (question.timeLimit || 0) - elapsed);
      pctRemaining =
        question.timeLimit > 0 ? Math.max(0, Math.min(100, (remaining / question.timeLimit) * 100)) : 0;
    }

    return (
      <Card
        elevation={0}
        data-testid={`question-card-${question.id}`}
        sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }}
      >
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5, mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#1D1B20", flex: 1 }}>
              {question.prompt || question.id}
            </Typography>
            <Chip
              label={chip.label}
              size="small"
              data-testid={`question-state-${question.id}`}
              sx={{ background: chip.bg, color: chip.color, fontWeight: 700, fontSize: 11, height: 22 }}
            />
          </Box>

          {/* Countdown while active (Requirement 9.2). */}
          {state === "active" && remaining !== null && (
            <Box sx={{ mb: 2 }} data-testid={`countdown-${question.id}`}>
              <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                  Time remaining
                </Typography>
                <Typography sx={{ fontSize: 12, color: "#6B7280" }}>
                  {Math.ceil(remaining)}s
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={pctRemaining}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  background: "#F3F4F6",
                  "& .MuiLinearProgress-bar": { background: ACCENT, transition: "width 1s linear" },
                }}
              />
            </Box>
          )}

          {/* Host controls (Requirement 9.4–9.6). */}
          <Box sx={{ display: "flex", gap: 1, mb: 2, flexWrap: "wrap" }}>
            <Button
              size="small"
              variant="contained"
              startIcon={<VisibilityOutlinedIcon />}
              disabled={!canReveal || busy}
              onClick={onReveal}
              sx={{ textTransform: "none", fontWeight: 600, background: ACCENT, "&:hover": { background: "#16A34A" } }}
            >
              Reveal Question
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<LockOutlinedIcon />}
              disabled={!canLock || busy}
              onClick={onLock}
              sx={{ textTransform: "none", fontWeight: 600, borderColor: "#B45309", color: "#B45309" }}
            >
              Lock
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<EmojiEventsOutlinedIcon />}
              disabled={!canRevealAnswer || busy}
              onClick={onRevealAnswer}
              sx={{ textTransform: "none", fontWeight: 600, borderColor: "#1D4ED8", color: "#1D4ED8" }}
            >
              Reveal Answer
            </Button>
          </Box>

          {/* Answer distribution (Requirement 9.7, 9.10). */}
          <Box>
            {options.map((opt) => {
              const count = opt.count || 0;
              const pct = opt.percentage || 0;
              const isCorrect = isRevealed && opt.id === question.correctOptionId;
              return (
                <Box key={opt.id} sx={{ mb: 1.25 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
                    <Typography
                      sx={{
                        fontSize: 13,
                        fontWeight: isCorrect ? 800 : 600,
                        color: isCorrect ? "#15803D" : "#374151",
                      }}
                    >
                      {opt.label}
                      {isCorrect ? " ✓" : ""}
                    </Typography>
                    <Typography
                      sx={{ fontSize: 13, color: "#6B7280" }}
                      data-testid={`opt-stat-${question.id}-${opt.id}`}
                    >
                      {count} · {pct}%
                    </Typography>
                  </Box>
                  <Box sx={{ height: 8, borderRadius: 4, background: "#F3F4F6", overflow: "hidden" }}>
                    <Box
                      data-testid={`opt-bar-${question.id}-${opt.id}`}
                      sx={{
                        height: "100%",
                        width: `${pct}%`,
                        background: isCorrect ? "#15803D" : ACCENT,
                        borderRadius: 4,
                        transition: "width 0.7s cubic-bezier(.2,.9,.25,1)",
                      }}
                    />
                  </Box>
                </Box>
              );
            })}

            <Typography sx={{ fontSize: 12, color: "#9CA3AF", mt: 1 }}>
              {zeroAnswers
                ? "No answers yet"
                : `${totalAnswers} total answer${totalAnswers === 1 ? "" : "s"}`}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }
);

QuestionCard.displayName = "QuestionCard";

/**
 * TriviaLiveDashboard — organizer-facing live host dashboard for a Trivia
 * Challenges instance. Mirrors LivePollLiveDashboard/RaffleLiveDashboard: a
 * LIVE/CLOSED header chip, a 2s ETag-optimized polling loop over getLiveStats
 * (only while a question is active or revealed), one memoized card per
 * question, reveal/lock/reveal-answer controls that optimistically reflect the
 * returned question state, an answer-distribution section, and the leaderboard.
 */
const TriviaLiveDashboard = () => {
  const { eventId, experienceId } = useParams();

  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyQuestionId, setBusyQuestionId] = useState(null);
  // A ticking clock so the countdown bar re-renders each second.
  const [now, setNow] = useState(Date.now());
  const etagRef = useRef(null);
  const pollRef = useRef(null);

  const fetchStats = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const config = {};
        if (etagRef.current) {
          config.headers = { "If-None-Match": etagRef.current };
          config.validateStatus = (status) => status === 200 || status === 304;
        }
        const res = await getLiveStats(eventId, experienceId, config);
        if (res.status === 304) {
          // Unchanged since last poll — skip re-render.
          return;
        }
        const etag = res.headers?.etag || res.headers?.["etag"];
        if (etag) etagRef.current = etag;
        setStats(res.data?.data || res.data);
        setError(null);
      } catch (err) {
        if (err.response?.status !== 304) {
          setError(err.response?.data?.message || "Failed to load trivia results");
        }
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [eventId, experienceId]
  );

  // Initial load.
  useEffect(() => {
    fetchStats(true);
  }, [fetchStats]);

  const questions = stats?.questions || [];
  const anyActiveOrRevealed = questions.some(
    (q) => q.questionState === "active" || q.questionState === "revealed"
  );

  // Keep a ref in sync with whether any question is active/revealed so the
  // interval tick can read the latest value without being torn down and
  // rebuilt on every state change.
  const shouldPollRef = useRef(anyActiveOrRevealed);
  shouldPollRef.current = anyActiveOrRevealed;

  // Set up a single 2s interval on mount (Requirement 9.3). Each tick only
  // actually refreshes while a question is active or revealed; otherwise it
  // idles. A failed refresh sets the error while the interval keeps running so
  // the next tick retries (Requirement 9.9).
  useEffect(() => {
    pollRef.current = setInterval(() => {
      if (!shouldPollRef.current) return;
      fetchStats(false);
      setNow(Date.now());
    }, REFRESH_INTERVAL);
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [fetchStats]);

  // Optimistically apply a returned question state into the local questions array.
  const applyQuestionState = (questionId, returnedQuestion, fallbackState) => {
    setStats((prev) => {
      if (!prev) return prev;
      const nextQuestions = (prev.questions || []).map((q) =>
        q.id === questionId
          ? {
              ...q,
              questionState: returnedQuestion?.questionState || fallbackState,
              revealedAt:
                returnedQuestion?.revealedAt !== undefined ? returnedQuestion.revealedAt : q.revealedAt,
              lockedAt:
                returnedQuestion?.lockedAt !== undefined ? returnedQuestion.lockedAt : q.lockedAt,
            }
          : q
      );
      return { ...prev, questions: nextQuestions };
    });
  };

  const runQuestionAction = useCallback(
    async (questionId, action, fallbackState) => {
      setBusyQuestionId(questionId);
      try {
        const res = await setQuestionState(eventId, experienceId, { action, questionId });
        const returned = res?.data?.data || res?.data;
        applyQuestionState(questionId, returned?.question, fallbackState);
        setNow(Date.now());
        // Clear the ETag so the next refresh reflects the change server-side.
        etagRef.current = null;
      } catch (err) {
        setError(err.response?.data?.message || "Failed to update question");
      } finally {
        setBusyQuestionId(null);
      }
    },
    [eventId, experienceId]
  );

  const distributions = stats?.distributions || [];
  const distByQuestion = new Map(distributions.map((d) => [d.questionId, d]));
  const entries = leaderboardEntries(stats?.leaderboard);
  const isClosed = stats?.state === "Closed" || stats?.state === "Analytics";
  const isLive = stats?.state === "Live";
  const anyActive = questions.some((q) => q.questionState === "active");

  if (loading && !stats) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 900, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }}>
          Trivia Challenges
        </Typography>
        <Chip
          label={isClosed ? "CLOSED" : "LIVE"}
          size="small"
          sx={{
            background: isClosed ? "#FEE2E2" : "#E8F5E9",
            color: isClosed ? "#DC2626" : "#2E7D32",
            fontWeight: 700,
            fontSize: 11,
            height: 22,
          }}
        />
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {questions.length === 0 ? (
        <Typography sx={{ color: "#9CA3AF", fontSize: 14, textAlign: "center", py: 6 }}>
          No questions configured yet.
        </Typography>
      ) : (
        questions.map((question) => (
          <QuestionCard
            key={question.id}
            question={question}
            distribution={distByQuestion.get(question.id)}
            now={now}
            isLive={isLive}
            anyActive={anyActive}
            busy={busyQuestionId === question.id}
            onReveal={() => runQuestionAction(question.id, "reveal_question", "active")}
            onLock={() => runQuestionAction(question.id, "lock_question", "locked")}
            onRevealAnswer={() => runQuestionAction(question.id, "reveal_answer", "revealed")}
          />
        ))
      )}

      {/* Leaderboard (Requirement 9.8) — rows ordered by ascending rank. */}
      {entries.length > 0 && (
        <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mt: 1 }} data-testid="leaderboard">
          <CardContent sx={{ p: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <EmojiEventsOutlinedIcon sx={{ color: ACCENT, fontSize: 22 }} />
              <Typography sx={{ fontWeight: 800, fontSize: 16, color: "#1D1B20" }}>
                Leaderboard
              </Typography>
            </Box>
            {[...entries]
              .sort((a, b) => (a.rank || 0) - (b.rank || 0))
              .map((entry) => (
                <Box
                  key={entry.attendeeId}
                  data-testid={`leaderboard-row-${entry.attendeeId}`}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    py: 1,
                    borderBottom: "1px solid #F3F4F6",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                    <Typography sx={{ fontWeight: 800, color: ACCENT, minWidth: 28 }}>
                      #{entry.rank}
                    </Typography>
                    <Typography sx={{ fontSize: 14, color: "#374151" }}>
                      {entry.attendeeId}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1D1B20" }}>
                    {entry.totalScore} pts
                  </Typography>
                </Box>
              ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
};

export default TriviaLiveDashboard;
