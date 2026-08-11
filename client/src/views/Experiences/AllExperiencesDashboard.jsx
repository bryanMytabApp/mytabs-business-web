import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Grid,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import IconButton from "@mui/material/IconButton";
import { getEventsByUserId } from "../../services/eventService";
import { listAllExperiences } from "../../services/experienceService";
import ExperienceCard from "../../components/Experiences/ExperienceCard";

const ACCENT = "#F09925";

/**
 * AllExperiencesDashboard — Top-level experiences view accessible from the sidebar.
 * Shows all experiences across all events for the current user.
 */
const AllExperiencesDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventExperiences, setEventExperiences] = useState([]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Get events for the business
      const userId = localStorage.getItem("userId") || localStorage.getItem("sub");
      const selectedBizId = sessionStorage.getItem("selectedBusinessId");
      const ownerUserId = selectedBizId || userId;
      
      // Fetch all events for this owner (no business header filtering)
      const eventsRes = await getEventsByUserId(ownerUserId);
      const events = eventsRes?.data?.data || eventsRes?.data || [];

      if (events.length === 0) {
        setEventExperiences([]);
        setLoading(false);
        return;
      }

      // Single batch request to get ALL experiences across all events
      const eventIds = events.map(e => e._id || e.id).filter(Boolean);
      const batchRes = await listAllExperiences(eventIds);
      const batchData = batchRes?.data?.data?.events || batchRes?.data?.events || [];

      // Merge event names with experience data
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

  const handleAction = async (eventId, experienceId, action) => {
    if (action === "configure") {
      navigate(`/admin/my-events/${eventId}/experiences/${experienceId}/config`);
    } else {
      // For lifecycle transitions, navigate to the event's experience dashboard
      navigate(`/admin/my-events/${eventId}/experiences`);
    }
  };

  const handleCardClick = (eventId, instance) => {
    const { experienceId, state } = instance;
    if (state === "Draft") {
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
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#1D1B20", fontSize: { xs: "1.5rem", md: "2rem" } }}>
            Tab Engagements
          </Typography>
          <Typography sx={{ color: "#71727A", fontSize: 14, mt: 0.5 }}>
            All interactive engagements across your events.
          </Typography>
        </Box>
        <IconButton onClick={fetchAll} size="small" sx={{ color: ACCENT }}>
          <RefreshIcon fontSize="small" />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      {/* Empty state */}
      {eventExperiences.length === 0 && !error && (
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

      {/* Grouped by event */}
      {eventExperiences.map(({ event, instances }) => (
        <Box key={event.id} sx={{ mb: 4 }}>
          <Box
            sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, cursor: "pointer" }}
            onClick={() => navigate(`/admin/my-events/${event.id}/experiences`, { state: { eventName: event.name } })}
          >
            <Typography sx={{ fontWeight: 700, fontSize: 15, color: "#1D1B20" }}>
              {event.name || "Untitled Event"}
            </Typography>
            <Chip
              label={`${instances.length} engagement${instances.length !== 1 ? "s" : ""}`}
              size="small"
              sx={{ fontSize: 11, fontWeight: 700, height: 22, background: "#F5F5F5", color: "#616161" }}
            />
            <Typography sx={{ fontSize: 12, color: "#9E9E9E", ml: "auto" }}>
              View event →
            </Typography>
          </Box>
          <Grid container spacing={2}>
            {instances.map((instance) => (
              <Grid item xs={12} sm={6} md={4} key={instance.experienceId}>
                <ExperienceCard
                  instance={instance}
                  onAction={(experienceId, action) => handleAction(event.id, experienceId, action)}
                  onClick={(inst) => handleCardClick(event.id, inst)}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Box>
  );
};

export default AllExperiencesDashboard;
