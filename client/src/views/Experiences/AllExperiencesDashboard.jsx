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
import { getEventsByUserId } from "../../services/eventService";
import { listAllExperiences } from "../../services/experienceService";
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

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = localStorage.getItem("userId") || localStorage.getItem("sub");
      const selectedBizId = sessionStorage.getItem("selectedBusinessId");
      const ownerUserId = selectedBizId || userId;

      const eventsRes = await getEventsByUserId(ownerUserId);
      const events = eventsRes?.data?.data || eventsRes?.data || [];
      setEvents(events);

      if (events.length === 0) {
        setEventExperiences([]);
        setLoading(false);
        return;
      }

      const eventIds = events.map(e => e._id || e.id).filter(Boolean);
      const batchRes = await listAllExperiences(eventIds);
      const batchData = batchRes?.data?.data?.events || batchRes?.data?.events || [];

      const eventMap = Object.fromEntries(events.map(e => [e._id || e.id, e]));
      const results = batchData
        .filter(r => r.instances && r.instances.length > 0)
        .map(r => ({
          event: { ...(eventMap[r.eventId] || {}), id: r.eventId },
          instances: r.instances,
        }));

      setEventExperiences(results);
    } catch (err) {
      setError(err.message || "Failed to load engagements");
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
    } else {
      navigate(`/admin/my-events/${eventId}/experiences`);
    }
  };

  const handleCardClick = (eventId, instance) => {
    const { experienceId, state } = instance;
    if (state === "Draft" || state === "Scheduled") {
      navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/config`);
    } else if (state === "Live" || state === "Paused") {
      navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/live`);
    } else {
      navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/analytics`);
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
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#1D1B20", fontSize: { xs: "1.5rem", md: "2rem" } }}>
            Tab Engagements
          </Typography>
          <Typography sx={{ color: "#71727A", fontSize: 14, mt: 0.5 }}>
            All interactive engagements across your events.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
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
          {filteredInstances.map((instance) => (
            <Grid item xs={12} sm={6} md={4} key={`${instance.eventId}-${instance.experienceId}`}>
              <Box sx={{ mb: 0.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#9E9E9E", mb: 0.5, px: 0.5 }}>
                  {instance.eventName}
                </Typography>
                <ExperienceCard
                  instance={instance}
                  onAction={(experienceId, action) => handleAction(instance.eventId, experienceId, action)}
                  onClick={(inst) => handleCardClick(instance.eventId, inst)}
                />
              </Box>
            </Grid>
          ))}
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
