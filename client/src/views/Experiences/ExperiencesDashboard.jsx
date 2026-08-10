import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Chip,
  Grid,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { listInstances, transitionState, deleteInstance } from "../../services/experienceService";
import ExperienceCard from "../../components/Experiences/ExperienceCard";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";

const ACCENT = "#F09925";

/**
 * Lifecycle states in display order.
 */
const LIFECYCLE_STATES = ["Draft", "Scheduled", "Live", "Paused", "Closed", "Analytics"];

/**
 * ExperiencesDashboard — lists all experience instances for an event,
 * grouped by lifecycle state, with quick actions per instance.
 *
 * Route: /admin/my-events/:eventId/experiences
 */
const ExperiencesDashboard = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const [eventName, setEventName] = useState(location.state?.eventName || "");

  // Fetch event name from instances API if not passed via navigation state
  useEffect(() => {
    if (!eventName && eventId) {
      listInstances(eventId)
        .then((res) => {
          const data = res.data?.data || res.data;
          const name = data?.eventName || data?.event?.name || "";
          if (name) setEventName(name);
        })
        .catch(() => {});
    }
  }, [eventId, eventName]);

  const fetchInstances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listInstances(eventId);
      const data = res.data?.data?.instances || res.data?.data || res.data?.instances || res.data || [];
      setInstances(Array.isArray(data) ? data : []);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Failed to load engagements";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchInstances();
  }, [fetchInstances]);

  // Auto-refresh every 10s when any experience is Live (for real-time entry counts)
  useEffect(() => {
    const hasLive = instances.some((i) => i.state === "Live");
    if (!hasLive) return;
    const interval = setInterval(fetchInstances, 10000);
    return () => clearInterval(interval);
  }, [instances, fetchInstances]);

  /**
   * Handle quick action from ExperienceCard.
   */
  const handleAction = async (experienceId, action) => {
    if (action === "configure") {
      navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/config`);
      return;
    }

    setActionLoading(experienceId);
    try {
      await transitionState(eventId, experienceId, { action });
      await fetchInstances();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Action failed";
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCardClick = (instance) => {
    if (selectMode) {
      toggleSelect(instance.experienceId);
      return;
    }
    const { experienceId, state } = instance;
    if (state === "Draft") {
      navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/config`);
    } else if (state === "Live" || state === "Paused") {
      navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/live`);
    } else {
      navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/analytics`);
    }
  };

  const toggleSelect = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleDeleteSelected = async () => {
    if (selected.length === 0) return;
    if (!window.confirm(`Delete ${selected.length} engagement${selected.length > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await Promise.all(selected.map(id => deleteInstance(eventId, id)));
      setSelected([]);
      setSelectMode(false);
      await fetchInstances();
    } catch (err) {
      setError(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Group instances by lifecycle state.
   */
  const groupedInstances = LIFECYCLE_STATES.reduce((acc, state) => {
    acc[state] = instances.filter((inst) => inst.state === state);
    return acc;
  }, {});

  // States that have at least one instance
  const activeStates = LIFECYCLE_STATES.filter((s) => groupedInstances[s].length > 0);

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
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          mb: 4,
          gap: 1,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#1D1B20", fontSize: { xs: "1.5rem", md: "2rem" } }}>
            Event Engagements
          </Typography>
          <Typography sx={{ color: "#71727A", fontSize: 14, mt: 0.5 }}>
            {eventName ? `${eventName} — Manage interactive engagements.` : `Manage interactive engagements for this event. (ID: ${eventId?.slice(0,8)})`}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {selectMode ? (
            <>
              <Button
                size="small"
                variant="outlined"
                onClick={() => { setSelectMode(false); setSelected([]); }}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<DeleteOutlineIcon />}
                disabled={selected.length === 0 || deleting}
                onClick={handleDeleteSelected}
                sx={{ textTransform: "none", fontWeight: 700, background: "#ef4444", "&:hover": { background: "#dc2626" } }}
              >
                {deleting ? "Deleting..." : `Delete (${selected.length})`}
              </Button>
            </>
          ) : (
            <>
              {instances.length > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => setSelectMode(true)}
                  sx={{ textTransform: "none", fontWeight: 600 }}
                >
                  Select
                </Button>
              )}
              <IconButton onClick={fetchInstances} size="small" disabled={loading} sx={{ color: ACCENT }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
              <Button
                variant="contained"
                startIcon={<AddCircleOutlineIcon />}
                onClick={() => navigate(`/admin/my-events/${eventId}/experiences/catalog`)}
                sx={{
                  background: ACCENT,
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 2,
                  px: 2.5,
                  "&:hover": { background: "#D4820F" },
                }}
              >
                Add Engagement
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Error alert */}
      {error && (
        <Alert
          severity="warning"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={fetchInstances} sx={{ textTransform: "none", fontWeight: 600 }}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {/* Empty state */}
      {instances.length === 0 && !error && (
        <Box
          sx={{
            textAlign: "center",
            py: 8,
            border: "1.5px dashed #E0E0E0",
            borderRadius: 3,
            background: "#FAFAFA",
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 48, color: "#BDBDBD", mb: 1.5 }} />
          <Typography sx={{ color: "#71727A", fontWeight: 600, fontSize: 16 }}>
            No engagements yet
          </Typography>
          <Typography sx={{ color: "#9E9E9E", fontSize: 13, mt: 0.5, mb: 2.5 }}>
            Add an engagement from the catalog to engage your attendees.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            onClick={() => navigate(`/admin/my-events/${eventId}/experiences/catalog`)}
            sx={{
              background: ACCENT,
              textTransform: "none",
              fontWeight: 700,
              borderRadius: 2,
              px: 3,
              "&:hover": { background: "#D4820F" },
            }}
          >
            Browse Catalog
          </Button>
        </Box>
      )}

      {/* Grouped instances by state */}
      {activeStates.map((state) => (
        <Box key={state} sx={{ mb: 4 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#1D1B20" }}>
              {state}
            </Typography>
            <Chip
              label={groupedInstances[state].length}
              size="small"
              sx={{ fontSize: 11, fontWeight: 700, height: 22, background: "#F5F5F5", color: "#616161" }}
            />
          </Box>
          <Grid container spacing={2}>
            {groupedInstances[state].map((instance) => (
              <Grid item xs={12} sm={6} md={4} key={instance.experienceId}>
                <Box sx={{ position: "relative" }}>
                  {selectMode && (
                    <Box
                      onClick={() => toggleSelect(instance.experienceId)}
                      sx={{ position: "absolute", top: 8, left: 8, zIndex: 2, cursor: "pointer" }}
                    >
                      {selected.includes(instance.experienceId)
                        ? <CheckBoxIcon sx={{ color: ACCENT }} />
                        : <CheckBoxOutlineBlankIcon sx={{ color: "#9E9E9E" }} />
                      }
                    </Box>
                  )}
                  <Box sx={{ opacity: selectMode && selected.includes(instance.experienceId) ? 0.7 : 1, border: selectMode && selected.includes(instance.experienceId) ? `2px solid ${ACCENT}` : "none", borderRadius: 2 }}>
                    <ExperienceCard
                      instance={instance}
                      onAction={handleAction}
                      onClick={handleCardClick}
                    />
                  </Box>
                </Box>
                {actionLoading === instance.experienceId && (
                  <Box sx={{ display: "flex", justifyContent: "center", mt: 0.5 }}>
                    <CircularProgress size={16} sx={{ color: ACCENT }} />
                  </Box>
                )}
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Box>
  );
};

export default ExperiencesDashboard;
