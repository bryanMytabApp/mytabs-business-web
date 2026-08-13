import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  TextField,
  InputAdornment,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SearchIcon from "@mui/icons-material/Search";
import { listInstances, transitionState, deleteInstance } from "../../services/experienceService";
import { getEvent } from "../../services/eventService";
import { parseJwt } from "../../utils/common";
import ExperienceCard from "../../components/Experiences/ExperienceCard";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckBoxOutlineBlankIcon from "@mui/icons-material/CheckBoxOutlineBlank";
import CheckBoxIcon from "@mui/icons-material/CheckBox";

const ACCENT = "#F09925";

const FILTER_TABS = ["All", "Draft", "Scheduled", "Live", "Paused", "Closed"];

/**
 * ExperiencesDashboard — lists all experience instances for an event,
 * with search, filter tabs, and a 3-column card grid.
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
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");

  // Fetch event name if not passed via navigation state
  useEffect(() => {
    if (!eventName && eventId) {
      const token = localStorage.getItem("idToken");
      const userId = parseJwt(token);
      if (userId) {
        getEvent(userId, eventId).then((res) => {
          const event = res?.data?.data || res?.data;
          const name = event?.name || event?.title || "";
          if (name) setEventName(name);
        }).catch(() => {});
      }
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

  // Auto-refresh every 10s when any experience is Live
  useEffect(() => {
    const hasLive = instances.some((i) => i.state === "Live");
    if (!hasLive) return;
    const interval = setInterval(fetchInstances, 10000);
    return () => clearInterval(interval);
  }, [instances, fetchInstances]);

  // Filtered and searched instances
  const filteredInstances = useMemo(() => {
    let result = instances;
    if (activeFilter !== "All") {
      result = result.filter((inst) => inst.state === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((inst) =>
        (inst.name || "").toLowerCase().includes(q) ||
        (inst.experienceType || "").toLowerCase().includes(q) ||
        (inst.state || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [instances, activeFilter, searchQuery]);

  // Count per filter tab
  const filterCounts = useMemo(() => {
    const counts = { All: instances.length };
    FILTER_TABS.forEach((tab) => {
      if (tab !== "All") counts[tab] = instances.filter((i) => i.state === tab).length;
    });
    return counts;
  }, [instances]);

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
    if (state === "Draft" || state === "Scheduled") {
      navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/config`);
    } else if (state === "Live" || state === "Paused") {
      navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/live`);
    } else {
      navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/analytics`);
    }
  };

  const toggleSelect = (id) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const handleDeleteSelected = async () => {
    if (selected.length === 0) return;
    if (!window.confirm(`Delete ${selected.length} engagement${selected.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await Promise.all(selected.map((id) => deleteInstance(eventId, id)));
      setSelected([]);
      setSelectMode(false);
      await fetchInstances();
    } catch (err) {
      setError(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

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
          mb: 3,
          gap: 1,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#1D1B20", fontSize: { xs: "1.5rem", md: "2rem" } }}>
            Event Engagements
          </Typography>
          <Typography sx={{ color: "#71727A", fontSize: 14, mt: 0.5 }}>
            Manage interactive engagements for this event.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {selectMode ? (
            <>
              <Button size="small" variant="outlined" onClick={() => { setSelectMode(false); setSelected([]); }} sx={{ textTransform: "none", fontWeight: 600 }}>
                Cancel
              </Button>
              <Button size="small" variant="contained" startIcon={<DeleteOutlineIcon />} disabled={selected.length === 0 || deleting} onClick={handleDeleteSelected} sx={{ textTransform: "none", fontWeight: 700, background: "#ef4444", "&:hover": { background: "#dc2626" } }}>
                {deleting ? "Deleting..." : `Delete (${selected.length})`}
              </Button>
            </>
          ) : (
            <>
              {instances.length > 0 && (
                <Button size="small" variant="outlined" onClick={() => setSelectMode(true)} sx={{ textTransform: "none", fontWeight: 600 }}>
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
                sx={{ background: ACCENT, textTransform: "none", fontWeight: 700, borderRadius: 2, px: 2.5, "&:hover": { background: "#D4820F" } }}
              >
                Add Engagement
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Search + Filter Bar */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <TextField
          size="small"
          placeholder="Search engagements..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: "#9E9E9E", fontSize: 20 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            minWidth: 220,
            "& .MuiOutlinedInput-root": {
              borderRadius: "20px",
              fontSize: 14,
              background: "#fff",
            },
          }}
        />
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
          {FILTER_TABS.map((tab) => {
            const count = filterCounts[tab] || 0;
            if (tab !== "All" && count === 0) return null;
            const isActive = activeFilter === tab;
            return (
              <Chip
                key={tab}
                label={tab}
                size="small"
                onClick={() => setActiveFilter(tab)}
                sx={{
                  fontWeight: 700,
                  fontSize: 13,
                  px: 1,
                  cursor: "pointer",
                  background: isActive ? ACCENT : "#F5F5F5",
                  color: isActive ? "#fff" : "#616161",
                  "&:hover": { background: isActive ? "#D4820F" : "#E8E8E8" },
                }}
              />
            );
          })}
        </Box>
        <Chip
          label={`${filteredInstances.length} engagement${filteredInstances.length !== 1 ? "s" : ""}`}
          size="small"
          sx={{ fontWeight: 600, fontSize: 12, background: "#E3F2FD", color: "#1565C0", ml: "auto" }}
        />
      </Box>

      {/* Error alert */}
      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }} action={<Button color="inherit" size="small" onClick={fetchInstances} sx={{ textTransform: "none", fontWeight: 600 }}>Retry</Button>}>
          {error}
        </Alert>
      )}

      {/* Empty state */}
      {instances.length === 0 && !error && (
        <Box sx={{ textAlign: "center", py: 8, border: "1.5px dashed #E0E0E0", borderRadius: 3, background: "#FAFAFA" }}>
          <AutoAwesomeIcon sx={{ fontSize: 48, color: "#BDBDBD", mb: 1.5 }} />
          <Typography sx={{ color: "#71727A", fontWeight: 600, fontSize: 16 }}>No engagements yet</Typography>
          <Typography sx={{ color: "#9E9E9E", fontSize: 13, mt: 0.5, mb: 2.5 }}>Add an engagement from the catalog to engage your attendees.</Typography>
          <Button variant="contained" startIcon={<AddCircleOutlineIcon />} onClick={() => navigate(`/admin/my-events/${eventId}/experiences/catalog`)} sx={{ background: ACCENT, textTransform: "none", fontWeight: 700, borderRadius: 2, px: 3, "&:hover": { background: "#D4820F" } }}>
            Browse Catalog
          </Button>
        </Box>
      )}

      {/* No results from search/filter */}
      {instances.length > 0 && filteredInstances.length === 0 && (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <Typography sx={{ color: "#71727A", fontWeight: 600, fontSize: 15 }}>No engagements match your search.</Typography>
          <Button size="small" onClick={() => { setSearchQuery(""); setActiveFilter("All"); }} sx={{ mt: 1, textTransform: "none", fontWeight: 600 }}>
            Clear filters
          </Button>
        </Box>
      )}

      {/* 3-column card grid */}
      {filteredInstances.length > 0 && (
        <Grid container spacing={2}>
          {filteredInstances.map((instance) => (
            <Grid item xs={12} sm={6} md={4} key={instance.experienceId}>
              <Box sx={{ position: "relative" }}>
                {selectMode && (
                  <Box onClick={() => toggleSelect(instance.experienceId)} sx={{ position: "absolute", top: 8, left: 8, zIndex: 2, cursor: "pointer" }}>
                    {selected.includes(instance.experienceId)
                      ? <CheckBoxIcon sx={{ color: ACCENT }} />
                      : <CheckBoxOutlineBlankIcon sx={{ color: "#9E9E9E" }} />
                    }
                  </Box>
                )}
                <Box sx={{ opacity: selectMode && selected.includes(instance.experienceId) ? 0.7 : 1, border: selectMode && selected.includes(instance.experienceId) ? `2px solid ${ACCENT}` : "none", borderRadius: 2 }}>
                  <Box sx={{ mb: 0.5 }}>
                    {eventName && (
                      <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#9E9E9E", mb: 0.5, px: 0.5 }}>
                        {eventName}
                      </Typography>
                    )}
                    <ExperienceCard
                      instance={{ ...instance, eventName }}
                      onAction={handleAction}
                      onClick={handleCardClick}
                    />
                  </Box>
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
      )}
    </Box>
  );
};

export default ExperiencesDashboard;
