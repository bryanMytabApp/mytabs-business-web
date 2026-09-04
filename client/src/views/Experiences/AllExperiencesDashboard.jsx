import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Grid,
  TextField,
  InputAdornment,
  IconButton,
  Modal,
  List,
  ListItemButton,
  ListItemText,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import http from "../../utils/axios/http";
import { listAllExperiences, deleteInstance } from "../../services/experienceService";
import { getCurrentUserId, buildAuthenticatedReturnUrl } from "../../utils/authUtils";
import ExperienceCard from "../../components/Experiences/ExperienceCard";

const ACCENT = "#F09925";
const FILTER_TABS = ["All", "Draft", "Scheduled", "Live", "Paused", "Closed"];

/**
 * AllExperiencesDashboard — Top-level experiences view accessible from the sidebar.
 * Shows all experiences across all events with search, filter tabs, and 3-column grid.
 */
const AllExperiencesDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventExperiences, setEventExperiences] = useState([]);
  const [events, setEvents] = useState([]);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState([]);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Resolve the effective user id for the events fetch. This mirrors
      // EventsView: we pass a userId in the path but the real scoping is done
      // by the X-Business-Id header (attached by the http interceptor from the
      // selected business). The backend's resolveEffectiveUserId turns that
      // header into the correct partition, so the engagements list follows the
      // business the user selected in the switcher — the same events they see
      // on the Events page.
      const userId =
        localStorage.getItem("userId") || localStorage.getItem("sub") || getCurrentUserId();

      console.log("📋 [Engagements] userId:", userId, "selectedBusinessId:", sessionStorage.getItem("selectedBusinessId"));

      if (!userId) {
        setEvents([]);
        setEventExperiences([]);
        setError("We couldn't confirm who you're signed in as. Please sign in again.");
        setLoading(false);
        return;
      }

      // Scope events to the selected business by letting the X-Business-Id
      // header apply (no skipBusinessContext). This matches EventsView so the
      // engagements shown belong to the currently-selected business.
      const eventsRes = await http.get(`/event/${userId}/all`);
      const events = eventsRes?.data?.data || eventsRes?.data || [];
      console.log("📋 [Engagements] getEventsByUserId response:", { eventsCount: events.length, rawKeys: Object.keys(eventsRes?.data || {}), firstEvent: events[0] ? { id: events[0]._id || events[0].id, name: events[0].name } : null });
      setEvents(events);

      if (events.length === 0) {
        console.log("📋 [Engagements] No events found — showing empty state");
        setEventExperiences([]);
        setLoading(false);
        return;
      }

      const eventIds = events.map(e => e._id || e.id).filter(Boolean);
      console.log("📋 [Engagements] Fetching experiences for", eventIds.length, "events:", eventIds.slice(0, 5));
      const { events: perEvent } = await listAllExperiences(eventIds);
      console.log("📋 [Engagements] listAllExperiences results:", perEvent.map(r => ({ eventId: r.eventId, instances: r.instances.length, error: r.error || null })));

      const eventMap = Object.fromEntries(events.map(e => [e._id || e.id, e]));
      const results = perEvent
        .filter(r => r.instances.length > 0)
        .map(r => ({
          event: { ...(eventMap[r.eventId] || {}), id: r.eventId },
          instances: r.instances,
        }));

      console.log("📋 [Engagements] Final results:", results.length, "events with instances, total instances:", results.reduce((sum, r) => sum + r.instances.length, 0));
      setEventExperiences(results);

      // Surface partial failures rather than presenting them as "no engagements".
      const failed = perEvent.filter(r => r.error);
      if (failed.length > 0) {
        console.warn("📋 [Engagements] Failed events:", failed);
        setError(
          `Couldn't load engagements for ${failed.length} of ${perEvent.length} event${perEvent.length !== 1 ? "s" : ""}.`
        );
      }
    } catch (err) {
      console.error("📋 [Engagements] fetchAll crashed:", err);
      setError(err.response?.data?.message || err.message || "Failed to load engagements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Flatten all instances with event info for filtering/searching
  const allInstances = useMemo(() => {
    return eventExperiences.flatMap(({ event, instances }) =>
      instances.map(inst => ({ ...inst, eventId: event.id, eventName: event.name || "Untitled Event" }))
    );
  }, [eventExperiences]);

  // Filtered and searched instances
  const filteredInstances = useMemo(() => {
    let result = allInstances;
    if (activeFilter !== "All") {
      result = result.filter(inst => inst.state === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(inst =>
        (inst.name || "").toLowerCase().includes(q) ||
        (inst.experienceType || "").toLowerCase().includes(q) ||
        (inst.eventName || "").toLowerCase().includes(q) ||
        (inst.state || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [allInstances, activeFilter, searchQuery]);

  // Count per filter tab
  const filterCounts = useMemo(() => {
    const counts = { All: allInstances.length };
    FILTER_TABS.forEach(tab => {
      if (tab !== "All") counts[tab] = allInstances.filter(i => i.state === tab).length;
    });
    return counts;
  }, [allInstances]);

  const handleAction = async (eventId, experienceId, action) => {
    if (action === "configure") {
      navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/config`);
    } else if (action === "activate" || action === "resume") {
      try {
        const { transitionState } = await import("../../services/experienceService");
        await transitionState(eventId, experienceId, { action: "activate" });
        setEventExperiences((prev) =>
          prev.map((group) => ({
            ...group,
            instances: group.instances.map((inst) =>
              inst.experienceId === experienceId ? { ...inst, state: "Live" } : inst
            ),
          }))
        );
      } catch (err) {
        console.error("Failed to activate:", err);
        alert(err.response?.data?.message || "Failed to activate. Please try again.");
      }
    } else if (action === "pause") {
      try {
        const { transitionState } = await import("../../services/experienceService");
        await transitionState(eventId, experienceId, { action: "pause" });
        setEventExperiences((prev) =>
          prev.map((group) => ({
            ...group,
            instances: group.instances.map((inst) =>
              inst.experienceId === experienceId ? { ...inst, state: "Paused" } : inst
            ),
          }))
        );
      } catch (err) {
        console.error("Failed to pause:", err);
        alert(err.response?.data?.message || "Failed to pause. Please try again.");
      }
    } else if (action === "close") {
      try {
        const { transitionState } = await import("../../services/experienceService");
        await transitionState(eventId, experienceId, { action: "close" });
        setEventExperiences((prev) =>
          prev.map((group) => ({
            ...group,
            instances: group.instances.map((inst) =>
              inst.experienceId === experienceId ? { ...inst, state: "Closed" } : inst
            ),
          }))
        );
      } catch (err) {
        console.error("Failed to close:", err);
        alert(err.response?.data?.message || "Failed to close. Please try again.");
      }
    } else {
      navigate(`/admin/my-events/${eventId}/experiences`);
    }
  };

  const handleCardClick = (eventId, instance) => {
    if (selectMode) {
      toggleSelect(`${eventId}:${instance.experienceId}`);
      return;
    }
    const { experienceId, state } = instance;
    if (state === "Draft" || state === "Scheduled") {
      navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/config`);
    } else {
      navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/live`);
    }
  };

  const toggleSelect = (key) => {
    setSelected((prev) => prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]);
  };

  const handleDeleteSelected = async () => {
    if (selected.length === 0) return;
    if (!window.confirm(`Delete ${selected.length} engagement${selected.length > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await Promise.all(selected.map((key) => {
        const [evId, expId] = key.split(":");
        return deleteInstance(evId, expId);
      }));
      setSelected([]);
      setSelectMode(false);
      await fetchAll();
    } catch (err) {
      alert(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  // Open the engagement verification app with the current session so the
  // operator isn't forced to log in again. The verify app accepts token +
  // userId query params for cross-subdomain SSO (mirrors the Verify Tickets
  // handoff on the Ticket Management page).
  const openVerifyApp = () => {
    const base = "https://verify.engage.keeptabs.app";
    const token = localStorage.getItem("idToken");
    const userId = getCurrentUserId();
    const url = token && userId ? buildAuthenticatedReturnUrl(base, token, userId) : base;
    window.open(url, "_blank", "noopener,noreferrer");
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
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#1D1B20", fontSize: { xs: "1.5rem", md: "2rem" } }}>
            Tab <span style={{ color: "#f97316" }}>Engagements</span>
          </Typography>
          <Typography sx={{ color: "#71727A", fontSize: 14, mt: 0.5 }}>
            All interactive engagements across your events.
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
              {allInstances.length > 0 && (
                <Button size="small" variant="outlined" onClick={() => setSelectMode(true)} sx={{ textTransform: "none", fontWeight: 600 }}>
                  Select
                </Button>
              )}
              <Button
                variant="outlined"
                onClick={openVerifyApp}
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 2,
                  color: ACCENT,
                  borderColor: ACCENT,
                  "&:hover": { borderColor: "#D4820F", background: "rgba(240,153,37,0.08)" },
                }}
              >
                Verify Engagements
              </Button>
              <Button
                variant="contained"
                startIcon={<AddCircleOutlineIcon />}
                onClick={() => { setShowEventPicker(true); setEventSearchQuery(""); }}
                sx={{
                  background: ACCENT,
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: 2,
                  "&:hover": { background: "#D4820F" },
                }}
              >
                Add Engagement
              </Button>
              <IconButton onClick={fetchAll} size="small" sx={{ color: ACCENT }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
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
          {FILTER_TABS.map(tab => {
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

      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Empty state */}
      {allInstances.length === 0 && !error && (
        <Box sx={{ textAlign: "center", py: 8, border: "1.5px dashed #E0E0E0", borderRadius: 3, background: "#FAFAFA" }}>
          <Typography sx={{ color: "#71727A", fontWeight: 600, fontSize: 16 }}>
            No engagements yet
          </Typography>
          <Typography sx={{ color: "#9E9E9E", fontSize: 13, mt: 0.5, mb: 2 }}>
            Create an event and add engagements from the catalog.
          </Typography>
          <Button
            variant="contained"
            onClick={() => navigate("/admin/my-events")}
            sx={{ background: ACCENT, textTransform: "none", fontWeight: 700, borderRadius: 2, "&:hover": { background: "#D4820F" } }}
          >
            Go to Events
          </Button>
        </Box>
      )}

      {/* No results from search/filter */}
      {allInstances.length > 0 && filteredInstances.length === 0 && (
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
          {filteredInstances.map((instance) => {
            const selectKey = `${instance.eventId}:${instance.experienceId}`;
            const isSelected = selected.includes(selectKey);
            return (
              <Grid item xs={12} sm={6} md={4} key={selectKey}>
                <Box sx={{ mb: 0.5 }}>
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#9E9E9E", mb: 0.5, px: 0.5 }}>
                    {instance.eventName}
                  </Typography>
                  <Box sx={{ position: "relative", borderRadius: "22px", overflow: "visible", outline: selectMode && isSelected ? `3px solid ${ACCENT}` : "none", outlineOffset: "2px", transition: "outline-color 0.15s ease" }}>
                    {selectMode && (
                      <Box
                        onClick={(e) => { e.stopPropagation(); toggleSelect(selectKey); }}
                        sx={{
                          position: "absolute",
                          top: 14,
                          left: 14,
                          zIndex: 2,
                          cursor: "pointer",
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          border: isSelected ? `2px solid ${ACCENT}` : "2px solid #BDBDBD",
                          background: isSelected ? ACCENT : "#fff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.15s ease",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                        }}
                      >
                        {isSelected && (
                          <Box sx={{ width: 10, height: 10, borderRadius: "50%", background: "#fff" }} />
                        )}
                      </Box>
                    )}
                    <ExperienceCard
                      instance={instance}
                      onAction={(experienceId, action) => handleAction(instance.eventId, experienceId, action)}
                      onClick={(inst) => handleCardClick(instance.eventId, inst)}
                    />
                  </Box>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Event Picker Modal */}
      <Modal open={showEventPicker} onClose={() => setShowEventPicker(false)}>
        <Box sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 420,
          maxHeight: "70vh",
          bgcolor: "#fff",
          borderRadius: 3,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}>
          <Box sx={{ p: 3, pb: 2 }}>
            <Typography sx={{ fontWeight: 800, fontSize: 18, color: "#1D1B20", mb: 0.5 }}>
              Select an Event
            </Typography>
            <Typography sx={{ fontSize: 13, color: "#71727A", mb: 2 }}>
              Choose which event to add an engagement to.
            </Typography>
            <TextField
              size="small"
              fullWidth
              placeholder="Search events..."
              value={eventSearchQuery}
              onChange={(e) => setEventSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: "#9E9E9E", fontSize: 20 }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "12px",
                  fontSize: 14,
                },
              }}
            />
          </Box>
          <List sx={{ overflow: "auto", flex: 1, px: 1, pb: 2 }}>
            {events
              .filter(ev => {
                if (!eventSearchQuery.trim()) return true;
                const q = eventSearchQuery.toLowerCase();
                return (ev.name || ev.title || "").toLowerCase().includes(q);
              })
              .map((ev) => {
                const id = ev._id || ev.id;
                const name = ev.name || ev.title || "Untitled Event";
                return (
                  <ListItemButton
                    key={id}
                    onClick={() => {
                      setShowEventPicker(false);
                      navigate(`/admin/my-events/${id}/experiences/catalog`);
                    }}
                    sx={{
                      borderRadius: 2,
                      mb: 0.5,
                      "&:hover": { background: "#FFF3E0" },
                    }}
                  >
                    <ListItemText
                      primary={name}
                      primaryTypographyProps={{ fontWeight: 700, fontSize: 14 }}
                      secondary={ev.startDate ? new Date(ev.startDate).toLocaleDateString() : null}
                      secondaryTypographyProps={{ fontSize: 12 }}
                    />
                  </ListItemButton>
                );
              })}
            {events.filter(ev => {
              if (!eventSearchQuery.trim()) return true;
              const q = eventSearchQuery.toLowerCase();
              return (ev.name || ev.title || "").toLowerCase().includes(q);
            }).length === 0 && (
              <Typography sx={{ textAlign: "center", color: "#9E9E9E", py: 3, fontSize: 13 }}>
                No events found.
              </Typography>
            )}
          </List>
        </Box>
      </Modal>
    </Box>
  );
};

export default AllExperiencesDashboard;
