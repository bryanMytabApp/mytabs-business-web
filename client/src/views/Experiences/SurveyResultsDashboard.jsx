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
} from "@mui/material";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import { getLiveStats, exportSurveyResults } from "../../services/experienceService";

const ACCENT = "#3B82F6"; // Feedback & Surveys brand color
const REFRESH_INTERVAL = 30000; // 30 seconds

/**
 * ChoicePanel — one proportional bar per Answer_Option (count + percentage).
 * Zero answers render every option at 0 (Requirement 8.3, 8.8).
 */
const ChoicePanel = React.memo(({ aggregate }) => {
  const options = aggregate?.options || [];
  const answerCount = aggregate?.answerCount || 0;

  return (
    <>
      {options.map((opt) => {
        const count = opt.count || 0;
        const pct = opt.percentage || 0;
        return (
          <Box key={opt.id} sx={{ mb: 1.25 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.5 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                {opt.label}
              </Typography>
              <Typography
                sx={{ fontSize: 13, color: "#6B7280" }}
                data-testid={`opt-stat-${aggregate.questionId}-${opt.id}`}
              >
                {count} · {pct}%
              </Typography>
            </Box>
            <Box sx={{ height: 8, borderRadius: 4, background: "#F3F4F6", overflow: "hidden" }}>
              <Box
                data-testid={`opt-bar-${aggregate.questionId}-${opt.id}`}
                sx={{
                  height: "100%",
                  width: `${pct}%`,
                  background: ACCENT,
                  borderRadius: 4,
                  transition: "width 0.7s cubic-bezier(.2,.9,.25,1)",
                }}
              />
            </Box>
          </Box>
        );
      })}
      {answerCount === 0 && (
        <Typography
          sx={{ fontSize: 12, color: "#9CA3AF", mt: 1 }}
          data-testid={`zero-${aggregate.questionId}`}
        >
          No responses yet
        </Typography>
      )}
    </>
  );
});

ChoicePanel.displayName = "ChoicePanel";

/**
 * RatingPanel — the average rating plus a distribution histogram, one bar per
 * integer value across the Rating_Scale. Zero answers render an average of 0
 * with every bucket empty (Requirement 8.4, 8.8).
 */
const RatingPanel = React.memo(({ aggregate }) => {
  const distribution = aggregate?.distribution || {};
  const answerCount = aggregate?.answerCount || 0;
  // Preserve numeric order of the scale buckets.
  const buckets = Object.keys(distribution)
    .map((k) => ({ value: k, count: distribution[k] || 0 }))
    .sort((a, b) => Number(a.value) - Number(b.value));
  const maxCount = buckets.reduce((m, b) => Math.max(m, b.count), 0) || 1;

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>
          AVERAGE RATING
        </Typography>
        <Typography
          sx={{ fontSize: 22, fontWeight: 800, color: "#1D1B20" }}
          data-testid={`avg-${aggregate.questionId}`}
        >
          {aggregate?.average ?? 0}
        </Typography>
      </Box>

      <Box data-testid={`distribution-${aggregate.questionId}`}>
        {buckets.map((b) => {
          const pct = (b.count / maxCount) * 100;
          return (
            <Box key={b.value} sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
              <Typography sx={{ fontSize: 12, color: "#6B7280", width: 20 }}>{b.value}</Typography>
              <Box sx={{ flex: 1, height: 8, borderRadius: 4, background: "#F3F4F6", overflow: "hidden" }}>
                <Box
                  data-testid={`dist-bar-${aggregate.questionId}-${b.value}`}
                  sx={{ height: "100%", width: `${pct}%`, background: ACCENT, borderRadius: 4 }}
                />
              </Box>
              <Typography
                sx={{ fontSize: 12, color: "#6B7280", width: 28, textAlign: "right" }}
                data-testid={`dist-count-${aggregate.questionId}-${b.value}`}
              >
                {b.count}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {answerCount === 0 && (
        <Typography
          sx={{ fontSize: 12, color: "#9CA3AF", mt: 1 }}
          data-testid={`zero-${aggregate.questionId}`}
        >
          No responses yet
        </Typography>
      )}
    </>
  );
});

RatingPanel.displayName = "RatingPanel";

/**
 * FreeTextPanel — the list of submitted text answers. Zero answers render a
 * "no responses yet" indicator (Requirement 8.5, 8.8).
 */
const FreeTextPanel = React.memo(({ aggregate }) => {
  const texts = aggregate?.texts || [];

  if (texts.length === 0) {
    return (
      <Typography
        sx={{ fontSize: 13, color: "#9CA3AF" }}
        data-testid={`zero-${aggregate.questionId}`}
      >
        No responses yet
      </Typography>
    );
  }

  return (
    <Box data-testid={`texts-${aggregate.questionId}`}>
      {texts.map((text, i) => (
        <Box
          key={i}
          data-testid={`text-${aggregate.questionId}-${i}`}
          sx={{ p: 1.25, mb: 1, borderRadius: 2, background: "#F8F9FA", border: "1px solid #F0F0F0" }}
        >
          <Typography sx={{ fontSize: 13, color: "#374151" }}>{text}</Typography>
        </Box>
      ))}
    </Box>
  );
});

FreeTextPanel.displayName = "FreeTextPanel";

/**
 * QuestionPanel — a card wrapping the type-appropriate summary panel for one
 * question. Memoized so a refresh that only changes one question does not
 * re-render the others.
 */
const QuestionPanel = React.memo(({ aggregate }) => {
  const type = aggregate?.type;
  return (
    <Card
      elevation={0}
      data-testid={`question-panel-${aggregate.questionId}`}
      data-type={type}
      sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 2 }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5, mb: 2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#1D1B20", flex: 1 }}>
            {aggregate?.prompt || aggregate?.questionId}
          </Typography>
          <Typography sx={{ fontSize: 12, color: "#9CA3AF" }} data-testid={`answer-count-${aggregate.questionId}`}>
            {aggregate?.answerCount || 0} responses
          </Typography>
        </Box>

        {(type === "single_choice" || type === "multiple_choice") && <ChoicePanel aggregate={aggregate} />}
        {type === "rating" && <RatingPanel aggregate={aggregate} />}
        {type === "free_text" && <FreeTextPanel aggregate={aggregate} />}
      </CardContent>
    </Card>
  );
});

QuestionPanel.displayName = "QuestionPanel";

/**
 * SurveyResultsDashboard — organizer-facing results dashboard for a Surveys
 * instance. Mirrors LivePollLiveDashboard/PulseFeedbackLiveDashboard: a header
 * with the survey title + open/closed chip + total response count, a 30s
 * ETag-optimized polling loop over getLiveStats, one summary panel per question
 * by type, and an export control that downloads the returned document.
 */
const SurveyResultsDashboard = () => {
  const { eventId, experienceId } = useParams();

  const [summary, setSummary] = useState(null);
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState(null);
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
        const data = res.data?.data || res.data;
        setSummary(data?.summary || null);
        setState(data?.state || null);
        setError(null);
      } catch (err) {
        if (err.response?.status !== 304) {
          setError(err.response?.data?.message || "Failed to load survey results");
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

  // Poll every 30s. A failed refresh sets the error but the interval keeps
  // running so the next tick retries (Requirement 8.7).
  useEffect(() => {
    pollRef.current = setInterval(() => {
      fetchStats(false);
    }, REFRESH_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchStats]);

  // Export the results document. The backend returns the export doc on the
  // live-stats route; we serialize it to a JSON Blob and trigger a browser
  // download, dependency-free (mirrors the CSV/JSON export elsewhere in the app).
  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      const res = await exportSurveyResults(eventId, experienceId);
      const payload = res.data?.data || res.data;
      const doc = payload?.export || payload;
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const safeTitle = (doc?.surveyTitle || summary?.title || "survey")
        .toString()
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase();
      link.download = `${safeTitle}-results.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      setExportError(err.response?.data?.message || err.message || "Failed to export results");
    } finally {
      setExporting(false);
    }
  }, [eventId, experienceId, summary]);

  const questions = summary?.questions || [];
  const title = summary?.title || "Survey Results";
  const totalResponses = summary?.totalResponses || 0;
  const isClosed = state === "Closed" || state === "Analytics";

  if (loading && !summary) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 800, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
        <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }} data-testid="survey-title">
          {title}
        </Typography>
        <Chip
          label={isClosed ? "CLOSED" : "OPEN"}
          size="small"
          data-testid="availability-chip"
          sx={{
            background: isClosed ? "#FEE2E2" : "#E8F5E9",
            color: isClosed ? "#DC2626" : "#2E7D32",
            fontWeight: 700,
            fontSize: 11,
            height: 22,
          }}
        />
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <Typography sx={{ color: "#374151", fontSize: 15 }} data-testid="total-responses">
          {totalResponses} total response{totalResponses === 1 ? "" : "s"}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<FileDownloadOutlinedIcon />}
          onClick={handleExport}
          disabled={exporting}
          data-testid="export-button"
          sx={{ textTransform: "none", fontWeight: 600, borderColor: ACCENT, color: ACCENT }}
        >
          {exporting ? "Exporting..." : "Export Results"}
        </Button>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}
      {exportError && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {exportError}
        </Alert>
      )}

      {questions.length === 0 ? (
        <Typography sx={{ color: "#9CA3AF", fontSize: 14, textAlign: "center", py: 6 }}>
          No questions configured yet.
        </Typography>
      ) : (
        questions.map((aggregate) => (
          <QuestionPanel key={aggregate.questionId} aggregate={aggregate} />
        ))
      )}
    </Box>
  );
};

export default SurveyResultsDashboard;
