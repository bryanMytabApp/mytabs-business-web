import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  CircularProgress,
  TextField,
  MenuItem,
  Grid,
  Divider,
  Alert,
  IconButton,
  Autocomplete,
  Collapse,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import SaveIcon from "@mui/icons-material/Save";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import { getDashboard, getAgent, updateAgent, deleteAgent, listSources, addSource, removeSource, validateSources, approveSource, listDrafts, triggerCrawl, approveDraft } from "../../services/aiAgentService";
import { getBusiness } from "../../services/businessService";
import { getMyOrganizations, getOrganizationBusinesses } from "../../services/organizationService";
import US_CITIES from "../../data/usCities";

const ACCENT = "#F09925";

const CRAWL_SCHEDULES = {
  Sourcing_Agent: ["Weekly", "Biweekly", "Monthly", "Manual"],
  Event_Creation_Agent: ["Hourly", "Every6Hours", "Daily", "Weekly", "Manual"],
};

const SCHEDULE_LABELS = {
  Hourly: "Hourly",
  Every6Hours: "Every Six Hours",
  Daily: "Daily",
  Weekly: "Weekly",
  Biweekly: "Bi-Weekly",
  Monthly: "Monthly",
  Manual: "Manual",
};

const EVENT_CATEGORIES = [
  "Bar", "Club", "Event Center", "Worship Center", "Religion",
  "Restaurant", "Café", "Concert Venue", "Theater", "Stadium",
  "Park", "Festival Grounds", "Other",
];

const AiAgentDetail = () => {
  const { agentId } = useParams();
  const navigate = useNavigate();

  const [agent, setAgent] = useState(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Editable fields
  const [form, setForm] = useState({});
  const [configOpen, setConfigOpen] = useState(false);
  const [newSourceUrl, setNewSourceUrl] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [draftsPage, setDraftsPage] = useState(1);

  // Available sourcing agents & businesses for Event Creation Agent config
  const [allAgents, setAllAgents] = useState([]);
  const [businessData, setBusinessData] = useState(null);

  const fetchAgent = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch full agent config
      const agentRes = await getAgent(agentId);
      const agentData = agentRes.data?.agent;
      if (!agentData) { setError("Agent not found"); setLoading(false); return; }

      // Fetch dashboard metrics for this agent
      let metrics = {};
      try {
        const dashRes = await getDashboard();
        const dashAgents = dashRes.data?.agents || [];
        setAllAgents(dashAgents);
        const found = dashAgents.find((a) => a.agentId === agentId);
        if (found) metrics = found;

        // Resolve linked sourcing agent name for Event Creation Agents
        if (agentData.linkedAgentIds?.length > 0) {
          const linkedAgent = dashAgents.find((a) => a.agentId === agentData.linkedAgentIds[0]);
          if (linkedAgent) agentData.linkedAgentName = linkedAgent.agentName;
        }
      } catch (e) { /* metrics optional */ }

      const merged = { ...agentData, ...metrics, agentName: agentData.name || metrics.agentName || "" };
      setAgent(merged);

      setForm({
        name: agentData.name || "",
        crawlSchedule: agentData.crawlSchedule || "Daily",
        publishSchedule: agentData.publishSchedule || "Manual",
        cities: agentData.cities || [],
        categories: agentData.categories || [],
        keywords: agentData.keywords || [],
        linkedSourcingAgentId: agentData.linkedAgentIds?.[0] || "",
        businessId: agentData.businessId || "",
      });

      // Fetch sources
      try {
        const srcRes = await listSources(agentId);
        setSources(srcRes.data?.sources || []);
      } catch (e) { setSources([]); }

      // Fetch drafts for Event Creation Agents (paginate to get all)
      if ((agentData.agentType || '').includes('Event_Creation')) {
        try {
          let allDrafts = [];
          let lastKey = null;
          do {
            const params = { agentId, limit: 50 };
            if (lastKey) params.startKey = JSON.stringify(lastKey);
            const draftsRes = await listDrafts(params);
            const draftsData = draftsRes.data?.items || draftsRes.data?.drafts || [];
            allDrafts = allDrafts.concat(draftsData);
            lastKey = draftsRes.data?.lastKey || null;
          } while (lastKey);
          setDrafts(allDrafts);
        } catch (e) { setDrafts([]); }
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Failed to load agent");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { fetchAgent(); }, [fetchAgent]);

  // Load businesses when config section is opened for Event Creation Agents
  useEffect(() => {
    if (configOpen && !businessData && agent?.agentType?.includes("Event_Creation")) {
      (async () => {
        try {
          let allBusinesses = [];
          const orgsRes = await getMyOrganizations();
          const orgs = orgsRes.data?.organizations || orgsRes.data || [];
          for (const org of orgs) {
            const orgId = org.organizationId || org.id;
            if (!orgId) continue;
            // Add the org payer business itself as the primary
            const payerBizId = org.payerBusinessId || org.organizationId || org.id;
            try {
              const payerBizRes = await getBusiness(payerBizId);
              const payerBiz = payerBizRes.data;
              if (payerBiz && (payerBiz.businessName || payerBiz.name)) {
                const exists = allBusinesses.some((b) => (b.linkedBusinessId || b.businessId) === payerBizId);
                if (!exists) {
                  allBusinesses.unshift({ linkedBusinessId: payerBiz.businessId || payerBizId, name: payerBiz.businessName || payerBiz.name, orgName: org.name, ...payerBiz });
                }
              }
            } catch (e) { /* skip */ }
            try {
              const bizRes = await getOrganizationBusinesses(orgId);
              const businesses = bizRes.data?.businesses || bizRes.data || [];
              allBusinesses = allBusinesses.concat(businesses.map((b) => ({ ...b, orgName: org.name })));
            } catch (e) { /* skip */ }
          }
          const userId = localStorage.getItem("userId") || localStorage.getItem("username");
          if (userId) {
            try {
              const bizRes = await getBusiness(userId);
              const biz = bizRes.data;
              if (biz && (biz.businessName || biz.name)) {
                const exists = allBusinesses.some((b) => (b.linkedBusinessId || b.businessId) === (biz.businessId || userId));
                if (!exists) {
                  allBusinesses.unshift({ linkedBusinessId: biz.businessId || userId, name: biz.businessName || biz.name, ...biz });
                }
              }
            } catch (e) { /* skip */ }
          }
          setBusinessData(allBusinesses);
        } catch (e) {
          setBusinessData([]);
        }
      })();
    }
  }, [configOpen, businessData, agent]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = {
        name: form.name,
        crawlSchedule: form.crawlSchedule,
      };

      if (agentType === "Sourcing_Agent") {
        payload.cities = form.cities;
        payload.categories = Array.isArray(form.categories) ? form.categories : form.categories.split(",").map((c) => c.trim()).filter(Boolean);
        payload.keywords = typeof form.keywords === "string" ? form.keywords.split(",").map((k) => k.trim()).filter(Boolean) : form.keywords;
      } else {
        // Event Creation Agent — update linked agent and business
        payload.linkedAgentIds = form.linkedSourcingAgentId ? [form.linkedSourcingAgentId] : [];
        payload.businessId = form.businessId || undefined;
        payload.publishSchedule = form.publishSchedule || "Manual";
      }

      await updateAgent(agentId, payload);
      setSuccess("Agent updated successfully");
      fetchAgent();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    const newStatus = agent.healthStatus === "Active" ? "idle" : "active";
    try {
      await updateAgent(agentId, { status: newStatus });
      setSuccess(`Agent ${newStatus === "active" ? "activated" : "paused"}`);
      fetchAgent();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update status");
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this agent permanently?")) return;
    try {
      await deleteAgent(agentId);
      navigate("/admin/ai-agents");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete");
    }
  };

  const handleAddSource = async () => {
    if (!newSourceUrl.trim()) return;
    setAddingSource(true);
    try {
      await addSource(agentId, { url: newSourceUrl.trim() });
      setNewSourceUrl("");
      setSuccess("Source added");
      const srcRes = await listSources(agentId);
      setSources(srcRes.data?.sources || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add source");
    } finally {
      setAddingSource(false);
    }
  };

  const handleRemoveSource = async (sourceId) => {
    try {
      await removeSource(agentId, sourceId);
      setSources((prev) => prev.filter((s) => s.sourceId !== sourceId));
    } catch (err) {
      setError(err.response?.data?.error || "Failed to remove source");
    }
  };

  const handleApproveSource = async (sourceId) => {
    try {
      await approveSource(agentId, sourceId);
      setSources((prev) => prev.map((s) => s.sourceId === sourceId ? { ...s, validationStatus: "verified" } : s));
      setSuccess("Source approved");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to approve source");
    }
  };

  const [validating, setValidating] = useState(false);
  const [publishingAll, setPublishingAll] = useState(false);
  const [runningDiscovery, setRunningDiscovery] = useState(false);
  const [approvingAll, setApprovingAll] = useState(false);
  const [sourceCityFilter, setSourceCityFilter] = useState("All");
  const [sourceGroupByCity, setSourceGroupByCity] = useState(false);
  const [draftCityFilter, setDraftCityFilter] = useState("All");
  const [draftGroupByCity, setDraftGroupByCity] = useState(false);
  const [draftSort, setDraftSort] = useState("date-asc");
  const [publishingDrafts, setPublishingDrafts] = useState(new Set());
  const [draftSelectMode, setDraftSelectMode] = useState(false);
  const [selectedDraftIds, setSelectedDraftIds] = useState(new Set());
  const [publishingSelected, setPublishingSelected] = useState(false);

  const handleValidateAll = async () => {
    setValidating(true);
    setError(null);
    try {
      await validateSources(agentId);
      setSuccess("Validation triggered for all sources. Refresh in ~30s to see results.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to trigger validation");
    } finally {
      setValidating(false);
    }
  };

  const handlePublishAll = async () => {
    const unpublished = drafts.filter(d => d.status === "draft");
    if (unpublished.length === 0) {
      setSuccess("No unpublished drafts to publish");
      return;
    }
    if (!window.confirm(`Publish ${unpublished.length} draft events to your business?`)) return;
    setPublishingAll(true);
    setError(null);
    let published = 0;
    let failed = 0;
    const failedDetails = [];
    for (const draft of unpublished) {
      try {
        await approveDraft(draft.draftId);
        setDrafts(prev => prev.map(d => d.draftId === draft.draftId ? { ...d, status: "approved" } : d));
        published++;
      } catch (err) {
        failed++;
        const reason = err.response?.data?.errors?.join(', ') || err.response?.data?.error || err.message;
        failedDetails.push(`"${draft.title}": ${reason}`);
        console.error(`Failed to publish "${draft.title}":`, reason);
      }
    }
    setPublishingAll(false);
    if (failed === 0) {
      setSuccess(`Successfully published ${published} events`);
    } else {
      setSuccess(`Published ${published} event${published !== 1 ? 's' : ''}, ${failed} failed`);
      setError(failedDetails.join('\n'));
    }
    fetchAgent();
  };

  const handleRunDiscovery = async () => {
    setRunningDiscovery(true);
    setError(null);
    try {
      await triggerCrawl(agentId);
      setSuccess("Discovery run triggered. New sources will appear in 2–5 minutes.");
    } catch (err) {
      setError(err.response?.data?.error || "Failed to trigger discovery");
    } finally {
      setRunningDiscovery(false);
    }
  };

  const handleApproveAll = async () => {
    const unapproved = sources.filter(s => (s.validationStatus || s.status) !== "verified");
    if (unapproved.length === 0) {
      setSuccess("All sources are already approved.");
      return;
    }
    setApprovingAll(true);
    setError(null);
    try {
      let approved = 0;
      for (const src of unapproved) {
        try {
          await approveSource(agentId, src.sourceId);
          approved++;
        } catch (e) { /* skip individual failures */ }
      }
      setSuccess(`Approved ${approved} source${approved !== 1 ? "s" : ""}. Refresh to see updated statuses.`);
      // Refresh sources list
      const srcRes = await listSources(agentId);
      if (srcRes.data?.sources) setSources(srcRes.data.sources);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to approve sources");
    } finally {
      setApprovingAll(false);
    }
  };

  const handlePublishDraft = async (draftId) => {
    setPublishingDrafts(prev => new Set(prev).add(draftId));
    setError(null);
    try {
      await approveDraft(draftId);
      // Update draft status locally to show as published
      setDrafts(prev => prev.map(d => d.draftId === draftId ? { ...d, status: "approved" } : d));
      setSuccess("Event published successfully!");
    } catch (err) {
      setError(err.response?.data?.errors?.join(', ') || err.response?.data?.error || `Failed to publish draft: ${err.message}`);
    } finally {
      setPublishingDrafts(prev => { const next = new Set(prev); next.delete(draftId); return next; });
    }
  };

  const toggleDraftSelect = (draftId, e) => {
    if (e) e.stopPropagation();
    setSelectedDraftIds(prev => {
      const next = new Set(prev);
      if (next.has(draftId)) next.delete(draftId);
      else next.add(draftId);
      return next;
    });
  };

  const toggleDraftSelectAll = () => {
    const unpublished = drafts.filter(d => d.status === "draft");
    if (selectedDraftIds.size === unpublished.length) {
      setSelectedDraftIds(new Set());
    } else {
      setSelectedDraftIds(new Set(unpublished.map(d => d.draftId)));
    }
  };

  const handlePublishSelected = async () => {
    const count = selectedDraftIds.size;
    if (count === 0) return;
    if (!window.confirm(`Publish ${count} selected draft${count > 1 ? 's' : ''} to your business?`)) return;
    setPublishingSelected(true);
    setError(null);
    let published = 0;
    let failed = 0;
    const failedDetails = [];
    for (const draftId of selectedDraftIds) {
      const draft = drafts.find(d => d.draftId === draftId);
      try {
        await approveDraft(draftId);
        setDrafts(prev => prev.map(d => d.draftId === draftId ? { ...d, status: "approved" } : d));
        published++;
      } catch (err) {
        failed++;
        const reason = err.response?.data?.errors?.join(', ') || err.response?.data?.error || err.message;
        failedDetails.push(`"${draft?.title || draftId}": ${reason}`);
        console.error(`Failed to publish draft ${draftId}:`, reason);
      }
    }
    setPublishingSelected(false);
    setSelectedDraftIds(new Set());
    setDraftSelectMode(false);
    if (failed === 0) {
      setSuccess(`Successfully published ${published} event${published > 1 ? 's' : ''}`);
    } else {
      setSuccess(`Published ${published} event${published !== 1 ? 's' : ''}, ${failed} failed`);
      setError(failedDetails.join('\n'));
    }
  };

  if (loading) {
    return <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}><CircularProgress sx={{ color: ACCENT }} /></Box>;
  }

  if (!agent) {
    return (
      <Box sx={{ p: 4, textAlign: "center" }}>
        <Typography color="error">{error || "Agent not found"}</Typography>
        <Button onClick={() => navigate("/admin/ai-agents")} sx={{ mt: 2 }}>Back to Dashboard</Button>
      </Box>
    );
  }

  const agentType = agent.agentType || "Event_Creation_Agent";
  const schedules = CRAWL_SCHEDULES[agentType] || CRAWL_SCHEDULES.Event_Creation_Agent;

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 900, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate("/admin/ai-agents")} sx={{ color: "#71727A" }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: "#1D1B20" }}>
            {agent.agentName}
          </Typography>
          <Typography sx={{ fontSize: 13, color: "#71727A" }}>
            {agentType === "Sourcing_Agent" ? "Sourcing Agent" : "Event Creation Agent"} · Created {agent.createdAt ? new Date(agent.createdAt).toLocaleDateString() : "—"}
          </Typography>
        </Box>
        <Chip
          label={agent.healthStatus}
          sx={{
            fontWeight: 700,
            fontSize: 13,
            background: agent.healthStatus === "Active" ? "#E8F5E9" : agent.healthStatus === "Error" ? "#FFEBEE" : "#F5F5F5",
            color: agent.healthStatus === "Active" ? "#2E7D32" : agent.healthStatus === "Error" ? "#C62828" : "#757575",
          }}
        />
        <Button
          variant="contained"
          startIcon={agent.healthStatus === "Active" ? <PauseIcon /> : <PlayArrowIcon />}
          onClick={handleToggleStatus}
          sx={{
            background: agent.healthStatus === "Active" ? "#757575" : "#4CAF50",
            textTransform: "none",
            fontWeight: 700,
            borderRadius: 2,
            "&:hover": { background: agent.healthStatus === "Active" ? "#616161" : "#388E3C" },
          }}
        >
          {agent.healthStatus === "Active" ? "Pause" : "Activate"}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>{success}</Alert>}

      {/* Metrics Overview */}
      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#1D1B20" }}>Performance</Typography>
            {agentType === "Sourcing_Agent" && (
              <Button
                variant="contained"
                size="small"
                startIcon={<PlayArrowIcon />}
                onClick={handleRunDiscovery}
                disabled={runningDiscovery}
                sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, background: "#7C4DFF", "&:hover": { background: "#5E35B1" } }}
              >
                {runningDiscovery ? "Running..." : "Run Discovery"}
              </Button>
            )}
            {agentType === "Event_Creation_Agent" && (
              <Button
                variant="contained"
                size="small"
                startIcon={<PlayArrowIcon />}
                onClick={handleRunDiscovery}
                disabled={runningDiscovery}
                sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, background: "#7C4DFF", "&:hover": { background: "#5E35B1" } }}
              >
                {runningDiscovery ? "Running..." : "Run Crawl"}
              </Button>
            )}
          </Box>
          <Grid container spacing={3}>
            {agentType === "Sourcing_Agent" ? (
              <>
                <Grid item xs={6} sm={3}>
                  <Typography sx={{ fontSize: 24, fontWeight: 800 }}>{sources.length}</Typography>
                  <Typography sx={{ fontSize: 11, color: "#71727A" }}>Sources Found</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography sx={{ fontSize: 24, fontWeight: 800 }}>{sources.filter((s) => (s.validationStatus || s.status) === "verified").length}</Typography>
                  <Typography sx={{ fontSize: 11, color: "#71727A" }}>Verified</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography sx={{ fontSize: 24, fontWeight: 800 }}>{sources.filter((s) => !s.validationStatus || s.validationStatus === "pending" || s.validationStatus === "unvalidated").length}</Typography>
                  <Typography sx={{ fontSize: 11, color: "#71727A" }}>Pending</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography sx={{ fontSize: 24, fontWeight: 800 }}>{agent.lastCrawlTimestamp ? new Date(agent.lastCrawlTimestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never"}</Typography>
                  <Typography sx={{ fontSize: 11, color: "#71727A" }}>Last Discovery</Typography>
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={6} sm={3}>
                  <Typography sx={{ fontSize: 24, fontWeight: 800 }}>{drafts.length}</Typography>
                  <Typography sx={{ fontSize: 11, color: "#71727A" }}>Drafts</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography sx={{ fontSize: 24, fontWeight: 800 }}>{drafts.filter((d) => d.status === "draft").length}</Typography>
                  <Typography sx={{ fontSize: 11, color: "#71727A" }}>Pending Review</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography sx={{ fontSize: 24, fontWeight: 800 }}>{drafts.filter((d) => d.status === "approved").length}</Typography>
                  <Typography sx={{ fontSize: 11, color: "#71727A" }}>Published</Typography>
                </Grid>
                <Grid item xs={6} sm={3}>
                  <Typography sx={{ fontSize: 24, fontWeight: 800 }}>{agent.lastCrawlTimestamp ? new Date(agent.lastCrawlTimestamp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Never"}</Typography>
                  <Typography sx={{ fontSize: 11, color: "#71727A" }}>Last Crawl</Typography>
                </Grid>
              </>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Configuration */}
      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setConfigOpen(!configOpen)}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#1D1B20" }}>Configuration</Typography>
            <IconButton size="small" sx={{ color: "#9E9E9E" }}>
              {configOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
          <Collapse in={configOpen}>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField label="Agent Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth size="small" />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField select label="Crawl Schedule" value={form.crawlSchedule} onChange={(e) => setForm({ ...form, crawlSchedule: e.target.value })} fullWidth size="small">
                {schedules.map((s) => <MenuItem key={s} value={s}>{SCHEDULE_LABELS[s] || s}</MenuItem>)}
              </TextField>
            </Grid>

            {agentType === "Sourcing_Agent" ? (
              <>
                <Grid item xs={12}>
                  <Autocomplete
                    multiple
                    options={US_CITIES}
                    value={Array.isArray(form.cities) ? form.cities : []}
                    onChange={(_, newValue) => setForm({ ...form, cities: newValue.slice(0, 20) })}
                    filterSelectedOptions
                    size="small"
                    renderInput={(params) => <TextField {...params} label="Cities" placeholder="Search cities..." />}
                    ChipProps={{ size: "small" }}
                    limitTags={5}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    multiple
                    options={EVENT_CATEGORIES}
                    value={Array.isArray(form.categories) ? form.categories : []}
                    onChange={(_, newValue) => setForm({ ...form, categories: newValue })}
                    filterSelectedOptions
                    size="small"
                    renderInput={(params) => <TextField {...params} label="Categories" placeholder="Select categories..." size="small" />}
                    ChipProps={{ size: "small" }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField label="Keywords (comma-separated)" value={Array.isArray(form.keywords) ? form.keywords.join(", ") : form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} fullWidth size="small" />
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    options={allAgents.filter((a) => a.agentType === "Sourcing_Agent")}
                    getOptionLabel={(opt) => opt.agentName || opt.name || ""}
                    value={allAgents.find((a) => a.agentId === form.linkedSourcingAgentId) || null}
                    onChange={(_, newValue) => setForm({ ...form, linkedSourcingAgentId: newValue?.agentId || "" })}
                    size="small"
                    renderInput={(params) => <TextField {...params} label="Linked Sourcing Agent" placeholder="Select a sourcing agent..." size="small" helperText="Sources come from this agent" />}
                    noOptionsText="No sourcing agents available"
                    isOptionEqualToValue={(opt, val) => opt.agentId === val.agentId}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Autocomplete
                    options={businessData || []}
                    getOptionLabel={(opt) => {
                      const name = opt.businessName || opt.name || opt.linkedBusinessId || "";
                      return opt.orgName ? `${name} — ${opt.orgName}` : name;
                    }}
                    value={(businessData || []).find((b) => (b.linkedBusinessId || b.businessId || b.id) === form.businessId) || null}
                    onChange={(_, newValue) => setForm({ ...form, businessId: newValue?.linkedBusinessId || newValue?.businessId || newValue?.id || "" })}
                    size="small"
                    loading={businessData === null}
                    renderInput={(params) => <TextField {...params} label="Target Business" placeholder="Search businesses..." size="small" helperText="Events publish to this business" />}
                    noOptionsText="No businesses found"
                    isOptionEqualToValue={(opt, val) => (opt.linkedBusinessId || opt.businessId || opt.id) === (val.linkedBusinessId || val.businessId || val.id)}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField select label="Publish Schedule" value={form.publishSchedule || "Manual"} onChange={(e) => setForm({ ...form, publishSchedule: e.target.value })} fullWidth size="small" helperText="Auto-publish approved drafts on this schedule">
                    <MenuItem value="Manual">Manual</MenuItem>
                    <MenuItem value="Hourly">Hourly</MenuItem>
                    <MenuItem value="Daily">Daily</MenuItem>
                    <MenuItem value="Weekly">Weekly</MenuItem>
                  </TextField>
                </Grid>
              </>
            )}
          </Grid>
          <Box sx={{ mt: 2, display: "flex", gap: 1 }}>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSave} disabled={saving} sx={{ background: ACCENT, textTransform: "none", fontWeight: 700, borderRadius: 2, "&:hover": { background: "#D4820F" } }}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </Box>
          </Collapse>
        </CardContent>
      </Card>

      {/* Sources (Sourcing Agent) or Draft Events (Event Creation Agent) */}
      {agentType === "Sourcing_Agent" ? (
      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#1D1B20" }}>Trusted Sources</Typography>
            {sources.length > 0 && (
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleApproveAll}
                  disabled={approvingAll || sources.every(s => (s.validationStatus || s.status) === "verified")}
                  sx={{ textTransform: "none", fontWeight: 700, borderColor: ACCENT, color: ACCENT, borderRadius: 2, "&:hover": { borderColor: "#D4820F", background: "#FFF3E0" } }}
                >
                  {approvingAll ? "Approving..." : "Approve All"}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<VerifiedOutlinedIcon />}
                  onClick={handleValidateAll}
                  disabled={validating}
                  sx={{ textTransform: "none", fontWeight: 700, borderColor: "#4CAF50", color: "#4CAF50", borderRadius: 2, "&:hover": { borderColor: "#2E7D32", background: "#E8F5E9" } }}
                >
                  {validating ? "Verifying..." : "Verify All"}
                </Button>
              </Box>
            )}
          </Box>
          {sources.length === 0 ? (
            <Typography sx={{ color: "#9E9E9E", fontSize: 13, mb: 2 }}>No sources added yet. Add URLs that this agent should monitor for events.</Typography>
          ) : (
            <Box sx={{ mb: 2 }}>
              {/* City filter bar */}
              {(() => {
                const citySet = [...new Set(sources.map(s => s.city || "Uncategorized"))].sort((a, b) => a === "Uncategorized" ? 1 : b === "Uncategorized" ? -1 : a.localeCompare(b));
                return (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
                    <Chip
                      label={`All (${sources.length})`}
                      size="small"
                      onClick={() => setSourceCityFilter("All")}
                      sx={{ fontSize: 11, fontWeight: sourceCityFilter === "All" ? 700 : 500, cursor: "pointer", background: sourceCityFilter === "All" ? "#1565C0" : "#F5F5F5", color: sourceCityFilter === "All" ? "#fff" : "#71727A", "&:hover": { background: sourceCityFilter === "All" ? "#1565C0" : "#E0E0E0" } }}
                    />
                    {citySet.map(city => {
                      const count = sources.filter(s => (s.city || "Uncategorized") === city).length;
                      return (
                        <Chip
                          key={city}
                          label={`${city} (${count})`}
                          size="small"
                          onClick={() => setSourceCityFilter(city)}
                          sx={{ fontSize: 11, fontWeight: sourceCityFilter === city ? 700 : 500, cursor: "pointer", background: sourceCityFilter === city ? "#1565C0" : "#F5F5F5", color: sourceCityFilter === city ? "#fff" : "#71727A", "&:hover": { background: sourceCityFilter === city ? "#1565C0" : "#E0E0E0" } }}
                        />
                      );
                    })}
                    <Box sx={{ ml: "auto" }}>
                      <Chip
                        label={sourceGroupByCity ? "Ungroup" : "Group by City"}
                        size="small"
                        variant={sourceGroupByCity ? "filled" : "outlined"}
                        onClick={() => setSourceGroupByCity(!sourceGroupByCity)}
                        sx={{ fontSize: 10, fontWeight: 600, cursor: "pointer", borderColor: "#90CAF9", color: sourceGroupByCity ? "#fff" : "#1565C0", background: sourceGroupByCity ? "#1565C0" : "transparent", "&:hover": { background: sourceGroupByCity ? "#0D47A1" : "#E3F2FD" } }}
                      />
                    </Box>
                  </Box>
                );
              })()}

              {/* Source list — grouped or flat based on toggle */}
              {(() => {
                const filtered = sourceCityFilter === "All" ? sources : sources.filter(s => (s.city || "Uncategorized") === sourceCityFilter);

                const renderSource = (src) => {
                  const status = src.validationStatus || src.status || "pending";
                  const statusColor = status === "verified" ? "#2E7D32" : status === "unverified" ? "#C62828" : "#F09925";
                  const statusBg = status === "verified" ? "#E8F5E9" : status === "unverified" ? "#FFEBEE" : "#FFF3E0";
                  const failureReason = src.connectorMetadata?.validationError || src.connectorMetadata?.failureReason || null;
                  const validationDetail = status === "unverified" && !failureReason ? "No structured event data (title + date) found on page — site may use JavaScript rendering" : null;
                  return (
                    <Box key={src.sourceId} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.2, pl: sourceGroupByCity ? 1.5 : 0, borderBottom: "1px solid #F5F5F5" }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#1D1B20" }}>{src.venueName || src.url}</Typography>
                          {!sourceGroupByCity && src.city && <Chip size="small" label={src.city} sx={{ fontSize: 9, fontWeight: 600, height: 18, background: "#E3F2FD", color: "#1565C0" }} />}
                        </Box>
                        <Typography sx={{ fontSize: 11, color: "#9E9E9E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {src.url}
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                          <Chip size="small" label={status} sx={{ fontSize: 10, fontWeight: 600, background: statusBg, color: statusColor, height: 20 }} />
                          <Typography sx={{ fontSize: 10, color: "#9E9E9E" }}>{src.connectorType || "screen_scraping"} · Quality: {src.sourceQualityScore || "—"}</Typography>
                        </Box>
                        {failureReason && <Typography sx={{ fontSize: 10, color: "#E65100", mt: 0.3 }}>⚠ {failureReason}</Typography>}
                        {!failureReason && validationDetail && <Typography sx={{ fontSize: 10, color: "#E65100", mt: 0.3 }}>⚠ {validationDetail}</Typography>}
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                        {status !== "verified" && (
                          <Button size="small" onClick={() => handleApproveSource(src.sourceId)} sx={{ fontSize: 10, textTransform: "none", color: "#4CAF50", minWidth: 0, px: 1 }}>
                            Approve
                          </Button>
                        )}
                        <IconButton size="small" onClick={() => handleRemoveSource(src.sourceId)} sx={{ color: "#BDBDBD", "&:hover": { color: "#E53935" } }}>
                          <LinkOffIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  );
                };

                if (!sourceGroupByCity) {
                  return filtered.map(renderSource);
                }

                // Grouped view
                const groups = filtered.reduce((acc, src) => {
                  const city = src.city || "Uncategorized";
                  if (!acc[city]) acc[city] = [];
                  acc[city].push(src);
                  return acc;
                }, {});

                return Object.entries(groups)
                  .sort(([a], [b]) => a === "Uncategorized" ? 1 : b === "Uncategorized" ? -1 : a.localeCompare(b))
                  .map(([city, citySources]) => (
                    <Box key={city} sx={{ mb: 2.5 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, pb: 0.5, borderBottom: "2px solid #E3F2FD" }}>
                        <Typography sx={{ fontSize: 13, fontWeight: 700, color: "#1565C0" }}>{city}</Typography>
                        <Chip size="small" label={citySources.length} sx={{ fontSize: 10, fontWeight: 700, height: 18, minWidth: 24, background: "#E3F2FD", color: "#1565C0" }} />
                      </Box>
                      {citySources.map(renderSource)}
                    </Box>
                  ));
              })()}
            </Box>
          )}
          <Divider sx={{ my: 2 }} />
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <TextField
              label="Source URL (https://...)"
              value={newSourceUrl}
              onChange={(e) => setNewSourceUrl(e.target.value)}
              size="small"
              sx={{ flex: 1 }}
              placeholder="https://example.com/events"
            />
            <Button
              variant="outlined"
              startIcon={<AddCircleOutlineIcon />}
              onClick={handleAddSource}
              disabled={addingSource || !newSourceUrl.trim()}
              sx={{ textTransform: "none", fontWeight: 700, borderColor: ACCENT, color: ACCENT, borderRadius: 2, whiteSpace: "nowrap", "&:hover": { borderColor: "#D4820F" } }}
            >
              {addingSource ? "Adding..." : "Add Source"}
            </Button>
          </Box>
        </CardContent>
      </Card>
      ) : (
      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#1D1B20" }}>Draft Events ({drafts.length})</Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              {drafts.filter(d => d.status === "draft").length > 0 && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => { setDraftSelectMode(!draftSelectMode); setSelectedDraftIds(new Set()); }}
                  sx={{ textTransform: "none", fontWeight: 600, fontSize: 12, borderRadius: 2, borderColor: draftSelectMode ? "#C62828" : "#90CAF9", color: draftSelectMode ? "#C62828" : "#1565C0", "&:hover": { borderColor: draftSelectMode ? "#B71C1C" : "#42A5F5", background: draftSelectMode ? "#FFEBEE" : "#E3F2FD" } }}
                >
                  {draftSelectMode ? "Cancel" : "Select"}
                </Button>
              )}
              {drafts.filter(d => d.status === "draft").length > 0 && !draftSelectMode && (
                <Button
                  variant="contained"
                  size="small"
                  onClick={handlePublishAll}
                  disabled={publishingAll}
                  sx={{ background: "#4CAF50", textTransform: "none", fontWeight: 700, borderRadius: 2, "&:hover": { background: "#388E3C" } }}
                >
                  {publishingAll ? `Publishing...` : `Publish All (${drafts.filter(d => d.status === "draft").length})`}
                </Button>
              )}
            </Box>
          </Box>
          {/* Bulk action bar for selected drafts */}
          {draftSelectMode && selectedDraftIds.size > 0 && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2, p: 1.5, background: "#E8F5E9", borderRadius: 2, border: "1px solid #A5D6A7" }}>
              <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#2E7D32" }}>{selectedDraftIds.size} selected</Typography>
              <Button size="small" onClick={toggleDraftSelectAll} sx={{ textTransform: "none", fontSize: 11, fontWeight: 600, color: "#1565C0" }}>
                {selectedDraftIds.size === drafts.filter(d => d.status === "draft").length ? "Deselect All" : "Select All"}
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handlePublishSelected}
                disabled={publishingSelected}
                sx={{ ml: "auto", textTransform: "none", fontWeight: 700, fontSize: 12, background: "#4CAF50", borderRadius: 2, "&:hover": { background: "#388E3C" } }}
              >
                {publishingSelected ? "Publishing..." : `Publish ${selectedDraftIds.size}`}
              </Button>
            </Box>
          )}
          {drafts.length === 0 ? (
            <Typography sx={{ color: "#9E9E9E", fontSize: 13 }}>
              No draft events yet. When this agent runs, it will crawl sources from its linked Sourcing Agent and create draft events here for your review.
            </Typography>
          ) : (
            <>
            {/* City filter bar for drafts */}
            {(() => {
              const citySet = [...new Set(drafts.map(d => d.city || "Uncategorized"))].sort((a, b) => a === "Uncategorized" ? 1 : b === "Uncategorized" ? -1 : a.localeCompare(b));
              return (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
                  <Chip
                    label={`All (${drafts.length})`}
                    size="small"
                    onClick={() => { setDraftCityFilter("All"); setDraftsPage(1); }}
                    sx={{ fontSize: 11, fontWeight: draftCityFilter === "All" ? 700 : 500, cursor: "pointer", background: draftCityFilter === "All" ? "#1565C0" : "#F5F5F5", color: draftCityFilter === "All" ? "#fff" : "#71727A", "&:hover": { background: draftCityFilter === "All" ? "#1565C0" : "#E0E0E0" } }}
                  />
                  {citySet.map(city => {
                    const count = drafts.filter(d => (d.city || "Uncategorized") === city).length;
                    return (
                      <Chip
                        key={city}
                        label={`${city} (${count})`}
                        size="small"
                        onClick={() => { setDraftCityFilter(city); setDraftsPage(1); }}
                        sx={{ fontSize: 11, fontWeight: draftCityFilter === city ? 700 : 500, cursor: "pointer", background: draftCityFilter === city ? "#1565C0" : "#F5F5F5", color: draftCityFilter === city ? "#fff" : "#71727A", "&:hover": { background: draftCityFilter === city ? "#1565C0" : "#E0E0E0" } }}
                      />
                    );
                  })}
                  <Box sx={{ ml: "auto", display: "flex", gap: 1, alignItems: "center" }}>
                    <TextField
                      select
                      size="small"
                      value={draftSort}
                      onChange={(e) => { setDraftSort(e.target.value); setDraftsPage(1); }}
                      sx={{ minWidth: 140, '& .MuiInputBase-root': { fontSize: 11, fontWeight: 600, borderRadius: 2, height: 28 }, '& .MuiSelect-select': { py: '4px' } }}
                    >
                      <MenuItem value="date-asc" sx={{ fontSize: 12 }}>Date ↑ (soonest)</MenuItem>
                      <MenuItem value="date-desc" sx={{ fontSize: 12 }}>Date ↓ (latest)</MenuItem>
                      <MenuItem value="city-asc" sx={{ fontSize: 12 }}>City A→Z</MenuItem>
                      <MenuItem value="city-desc" sx={{ fontSize: 12 }}>City Z→A</MenuItem>
                      <MenuItem value="name-asc" sx={{ fontSize: 12 }}>Name A→Z</MenuItem>
                      <MenuItem value="name-desc" sx={{ fontSize: 12 }}>Name Z→A</MenuItem>
                    </TextField>
                    <Chip
                      label={draftGroupByCity ? "Ungroup" : "Group by City"}
                      size="small"
                      variant={draftGroupByCity ? "filled" : "outlined"}
                      onClick={() => setDraftGroupByCity(!draftGroupByCity)}
                      sx={{ fontSize: 10, fontWeight: 600, cursor: "pointer", borderColor: "#90CAF9", color: draftGroupByCity ? "#fff" : "#1565C0", background: draftGroupByCity ? "#1565C0" : "transparent", "&:hover": { background: draftGroupByCity ? "#0D47A1" : "#E3F2FD" } }}
                    />
                  </Box>
                </Box>
              );
            })()}

            {/* Draft cards — grouped or flat */}
            {(() => {
              let filtered = draftCityFilter === "All" ? [...drafts] : drafts.filter(d => (d.city || "Uncategorized") === draftCityFilter);

              // Apply sort
              filtered.sort((a, b) => {
                switch (draftSort) {
                  case 'date-asc': {
                    const da = (a.date || '') + (a.time || '');
                    const db = (b.date || '') + (b.time || '');
                    return da.localeCompare(db);
                  }
                  case 'date-desc': {
                    const da = (a.date || '') + (a.time || '');
                    const db = (b.date || '') + (b.time || '');
                    return db.localeCompare(da);
                  }
                  case 'city-asc':
                    return (a.city || '').localeCompare(b.city || '');
                  case 'city-desc':
                    return (b.city || '').localeCompare(a.city || '');
                  case 'name-asc':
                    return (a.title || '').localeCompare(b.title || '');
                  case 'name-desc':
                    return (b.title || '').localeCompare(a.title || '');
                  default:
                    return 0;
                }
              });

              const renderDraftCard = (draft) => {
                const isPublished = draft.status === "approved";
                const isPublishing = publishingDrafts.has(draft.draftId);
                const isSelected = selectedDraftIds.has(draft.draftId);
                return (
                <Grid item xs={12} sm={6} key={draft.draftId}>
                  <Card
                    variant="outlined"
                    sx={{ borderRadius: 2, overflow: "hidden", transition: "all 0.2s", opacity: isPublished ? 0.5 : 1, position: "relative", borderColor: draftSelectMode && isSelected ? "#4CAF50" : undefined, borderWidth: draftSelectMode && isSelected ? 2 : 1, "&:hover": isPublished ? {} : { borderColor: draftSelectMode ? "#4CAF50" : "#F09925", boxShadow: "0 4px 16px rgba(240,153,37,0.12)" } }}
                    onClick={() => {
                      if (draftSelectMode && !isPublished) {
                        toggleDraftSelect(draft.draftId);
                      } else if (!isPublished) {
                        navigate("/admin/my-events/create", { state: { draft } });
                      }
                    }}
                  >
                    {/* Select checkbox overlay */}
                    {draftSelectMode && !isPublished && (
                      <Box
                        onClick={(e) => toggleDraftSelect(draft.draftId, e)}
                        sx={{ position: "absolute", top: 10, left: 10, zIndex: 2, width: 24, height: 24, borderRadius: "50%", background: isSelected ? "#4CAF50" : "rgba(255,255,255,0.9)", border: isSelected ? "2px solid #4CAF50" : "2px solid #BDBDBD", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.15s", boxShadow: "0 2px 6px rgba(0,0,0,0.15)", "&:hover": { borderColor: "#4CAF50", background: isSelected ? "#388E3C" : "rgba(255,255,255,1)" } }}
                      >
                        {isSelected && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                      </Box>
                    )}
                    <Box sx={{ cursor: isPublished ? "default" : "pointer" }}>
                    {draft.imageUrl ? (
                      <Box sx={{ height: 140, overflow: "hidden", background: "#F5F5F5" }}>
                        <img src={draft.imageUrl} alt={draft.title} style={{ width: "100%", height: "100%", objectFit: "cover", filter: isPublished ? "grayscale(0.7)" : "none" }} onError={(e) => { e.target.style.display = "none"; e.target.parentElement.style.display = "flex"; e.target.parentElement.style.alignItems = "center"; e.target.parentElement.style.justifyContent = "center"; }} />
                      </Box>
                    ) : (
                      <Box sx={{ height: 140, background: isPublished ? "#F5F5F5" : "linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Typography sx={{ fontSize: 32, fontWeight: 800, color: isPublished ? "#BDBDBD" : "#F09925", opacity: 0.4 }}>
                          {(draft.title || "E").charAt(0).toUpperCase()}
                        </Typography>
                      </Box>
                    )}
                    </Box>
                    <Box sx={{ p: 2 }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 0.5 }}>
                        <Typography sx={{ fontSize: 14, fontWeight: 700, color: isPublished ? "#9E9E9E" : "#1D1B20", flex: 1 }}>{draft.title}</Typography>
                        <Chip size="small" label={isPublished ? "published" : (draft.status || "draft")} sx={{ fontSize: 9, fontWeight: 600, background: isPublished ? "#E8F5E9" : "#FFF3E0", color: isPublished ? "#2E7D32" : "#F09925", height: 18, ml: 1 }} />
                      </Box>
                      <Typography sx={{ fontSize: 12, color: "#71727A" }}>
                        {draft.date ? new Date(draft.date + (draft.date.includes("T") ? "" : "T00:00:00")).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}{draft.time ? ` at ${(() => { const [h,m] = draft.time.split(":"); const hr = parseInt(h); return `${hr > 12 ? hr - 12 : hr || 12}:${m} ${hr >= 12 ? "PM" : "AM"}`; })()}` : ""}
                      </Typography>
                      {draft.venue && <Typography sx={{ fontSize: 11, color: "#9E9E9E" }}>{draft.venue}</Typography>}
                      {!draftGroupByCity && <Typography sx={{ fontSize: 11, color: draft.city ? "#1565C0" : "#BDBDBD", fontWeight: draft.city ? 600 : 400 }}>
                        {draft.city || "City unavailable"}
                      </Typography>}
                      {draft.description && <Typography sx={{ fontSize: 11, color: "#BDBDBD", mt: 0.5 }}>{draft.description.slice(0, 80)}{draft.description.length > 80 ? "..." : ""}</Typography>}
                      {!isPublished && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(e) => { e.stopPropagation(); handlePublishDraft(draft.draftId); }}
                          disabled={isPublishing}
                          sx={{ mt: 1, textTransform: "none", fontWeight: 700, fontSize: 11, borderColor: "#4CAF50", color: "#4CAF50", borderRadius: 2, "&:hover": { borderColor: "#2E7D32", background: "#E8F5E9" } }}
                        >
                          {isPublishing ? "Publishing..." : "Publish"}
                        </Button>
                      )}
                      {isPublished && (
                        <Typography sx={{ fontSize: 10, color: "#4CAF50", fontWeight: 600, mt: 1 }}>✓ Published</Typography>
                      )}
                    </Box>
                  </Card>
                </Grid>
                );
              };

              if (!draftGroupByCity) {
                const paginated = filtered.slice((draftsPage - 1) * 10, draftsPage * 10);
                return (
                  <>
                    <Grid container spacing={2}>
                      {paginated.map(renderDraftCard)}
                    </Grid>
                    {filtered.length > 10 && (
                      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1, mt: 2.5 }}>
                        <Button size="small" disabled={draftsPage === 1} onClick={() => setDraftsPage((p) => p - 1)} sx={{ textTransform: "none", fontWeight: 600, color: ACCENT, minWidth: 32 }}>&laquo; Prev</Button>
                        {Array.from({ length: Math.ceil(filtered.length / 10) }, (_, i) => (
                          <Button key={i} size="small" onClick={() => setDraftsPage(i + 1)} sx={{ minWidth: 32, fontWeight: draftsPage === i + 1 ? 800 : 500, color: draftsPage === i + 1 ? "#fff" : "#71727A", background: draftsPage === i + 1 ? ACCENT : "transparent", borderRadius: 1.5, "&:hover": { background: draftsPage === i + 1 ? ACCENT : "#F5F5F5" } }}>
                            {i + 1}
                          </Button>
                        ))}
                        <Button size="small" disabled={draftsPage >= Math.ceil(filtered.length / 10)} onClick={() => setDraftsPage((p) => p + 1)} sx={{ textTransform: "none", fontWeight: 600, color: ACCENT, minWidth: 32 }}>Next &raquo;</Button>
                      </Box>
                    )}
                  </>
                );
              }

              // Grouped view
              const groups = filtered.reduce((acc, d) => {
                const city = d.city || "Uncategorized";
                if (!acc[city]) acc[city] = [];
                acc[city].push(d);
                return acc;
              }, {});

              return Object.entries(groups)
                .sort(([a], [b]) => a === "Uncategorized" ? 1 : b === "Uncategorized" ? -1 : a.localeCompare(b))
                .map(([city, cityDrafts]) => (
                  <Box key={city} sx={{ mb: 3 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, pb: 0.5, borderBottom: "2px solid #E3F2FD" }}>
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1565C0" }}>{city}</Typography>
                      <Chip size="small" label={cityDrafts.length} sx={{ fontSize: 10, fontWeight: 700, height: 18, minWidth: 24, background: "#E3F2FD", color: "#1565C0" }} />
                    </Box>
                    <Grid container spacing={2}>
                      {cityDrafts.map(renderDraftCard)}
                    </Grid>
                  </Box>
                ));
            })()}
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* Danger Zone */}
      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #FFCDD2" }}>
        <CardContent sx={{ p: 3 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 16, color: "#C62828", mb: 1 }}>Danger Zone</Typography>
          <Typography sx={{ fontSize: 13, color: "#71727A", mb: 2 }}>Permanently delete this agent and all its configuration. This cannot be undone.</Typography>
          <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />} onClick={handleDelete} sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}>
            Delete Agent
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AiAgentDetail;
