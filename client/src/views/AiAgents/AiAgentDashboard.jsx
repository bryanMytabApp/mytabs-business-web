import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  LinearProgress,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Alert,
  IconButton,
  Autocomplete,
  Snackbar,
} from "@mui/material";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import DraftsOutlinedIcon from "@mui/icons-material/DraftsOutlined";
import PublishOutlinedIcon from "@mui/icons-material/PublishOutlined";
import RadarOutlinedIcon from "@mui/icons-material/RadarOutlined";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import HistoryOutlinedIcon from "@mui/icons-material/HistoryOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import PauseIcon from "@mui/icons-material/Pause";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import RocketLaunchOutlinedIcon from "@mui/icons-material/RocketLaunchOutlined";
import { getDashboard, createAgent, deleteAgent, updateAgent, validateSources, triggerCrawl, listSources, listDrafts as listAgentDrafts } from "../../services/aiAgentService";
import { getBusiness } from "../../services/businessService";
import { getMyOrganizations, getOrganizationBusinesses } from "../../services/organizationService";
import US_CITIES from "../../data/usCities";

const ACCENT = "#F09925";

const AGENT_TYPES = [
  { value: "Sourcing_Agent", label: "Sourcing Agent", description: "Discovers event venues and sources in your target cities using AI" },
  { value: "Event_Creation_Agent", label: "Event Creation Agent", description: "Crawls verified sources and extracts events for your business" },
];

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

const formatTokenPool = (value) => {
  if (value === Infinity) return "Unlimited";
  if (value >= 1000000) return `${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return String(value);
};

const EVENT_CATEGORIES = [
  "Bar", "Club", "Event Center", "Worship Center", "Religion",
  "Restaurant", "Café", "Concert Venue", "Theater", "Stadium",
  "Park", "Festival Grounds", "Other",
];

const INITIAL_FORM = { agentType: "Sourcing_Agent", name: "", cities: [], categories: [], keywords: "", crawlSchedule: "Weekly", linkedSourcingAgentId: "", businessId: "" };

const AiAgentDashboard = () => {
  const navigate = useNavigate();

  // Dashboard data from backend
  const [dashData, setDashData] = useState({ agents: [], summary: null });
  const [dashLoading, setDashLoading] = useState(true);
  const [dashError, setDashError] = useState(null);

  // Create Agent dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(INITIAL_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [businessData, setBusinessData] = useState(null);

  // Load businesses when dialog opens (via organizations)
  useEffect(() => {
    if (createOpen && !businessData) {
      (async () => {
        try {
          let allBusinesses = [];

          // Load via organizations
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

          // Also try loading the user's own business
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
  }, [createOpen, businessData]);

  const fetchDashboard = useCallback(async () => {
    setDashLoading(true);
    setDashError(null);
    try {
      const res = await getDashboard();
      console.log('[AiAgentDashboard] API response:', JSON.stringify(res.data)?.slice(0, 200));
      console.log('[AiAgentDashboard] Agents count:', res.data?.agents?.length, 'isOrgView:', res.data?.isOrgView);
      setDashData(res.data || { agents: [], summary: null });
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to load dashboard";
      console.error('[AiAgentDashboard] Error:', msg, err);
      setDashError(msg);
    } finally {
      setDashLoading(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleCreateAgent = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const payload = {
        agentType: form.agentType,
        name: form.name.trim(),
        crawlSchedule: form.crawlSchedule,
      };

      if (form.agentType === "Sourcing_Agent") {
        payload.cities = form.cities;
        payload.categories = form.categories;
        payload.keywords = form.keywords ? form.keywords.split(",").map((k) => k.trim()).filter(Boolean) : ["events"];
      } else {
        // Event Creation Agent — link to sourcing agent and business
        payload.linkedAgentIds = form.linkedSourcingAgentId ? [form.linkedSourcingAgentId] : [];
        payload.businessId = form.businessId || undefined;
        payload.cities = ["All"]; // inherited from sourcing agent
        payload.categories = ["All"];
        payload.keywords = ["events"];
      }

      await createAgent(payload);
      setCreateOpen(false);
      setForm(INITIAL_FORM);
      fetchDashboard();
    } catch (err) {
      setCreateError(err.response?.data?.error || err.message || "Failed to create agent");
    } finally {
      setCreating(false);
    }
  };

  // Delete Agent dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAgent = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteAgent(deleteTarget);
      setDeleteOpen(false);
      setDeleteTarget(null);
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete agent");
    } finally {
      setDeleting(false);
    }
  };

  const confirmDelete = (agentId) => {
    setDeleteTarget(agentId);
    setDeleteOpen(true);
  };

  const handleToggleAgent = async (agentId, currentStatus) => {
    const newStatus = currentStatus === "Active" ? "idle" : "active";
    try {
      await updateAgent(agentId, { status: newStatus });
      fetchDashboard();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update agent status");
    }
  };

  const [verifyingAgentIds, setVerifyingAgentIds] = useState(new Set());
  const [verifySuccess, setVerifySuccess] = useState(null);
  const [crawlingAgentIds, setCrawlingAgentIds] = useState(new Set());
  const pollingRef = useRef({});

  // Poll a single agent's data and update only that card
  const startPollingAgent = (agentId) => {
    if (pollingRef.current[agentId]) return;
    const agent = (dashData.agents || []).find((a) => a.agentId === agentId);
    const isSourcing = agent?.agentType === "Sourcing_Agent";

    const interval = setInterval(async () => {
      try {
        if (isSourcing) {
          // For sourcing agents, fetch sources to get updated counts
          const srcRes = await listSources(agentId);
          const sources = srcRes.data?.sources || [];
          const verified = sources.filter((s) => s.validationStatus === "verified").length;
          const pending = sources.filter((s) => !s.validationStatus || s.validationStatus === "pending" || s.validationStatus === "unvalidated").length;
          setDashData((prev) => ({
            ...prev,
            agents: (prev.agents || []).map((a) =>
              a.agentId === agentId ? { ...a, sourcesMonitored: sources.length, sourcesVerified: verified, sourcesPending: pending } : a
            ),
          }));
        } else {
          // For event creation agents, fetch drafts to get updated counts
          const draftsRes = await listAgentDrafts({ agentId });
          const drafts = draftsRes.data?.items || [];
          const draftsPending = drafts.filter((d) => d.status === "draft").length;
          const published = drafts.filter((d) => d.status === "approved").length;
          setDashData((prev) => ({
            ...prev,
            agents: (prev.agents || []).map((a) =>
              a.agentId === agentId ? { ...a, draftsPendingReview: draftsPending, publishedEventsCount: published, eventsDiscoveredToday: drafts.length } : a
            ),
          }));
        }
      } catch (e) { /* ignore polling errors */ }
    }, 10000);

    pollingRef.current[agentId] = interval;
    setTimeout(() => { stopPollingAgent(agentId); }, 60000);
  };

  const stopPollingAgent = (agentId) => {
    if (pollingRef.current[agentId]) {
      clearInterval(pollingRef.current[agentId]);
      delete pollingRef.current[agentId];
    }
  };

  useEffect(() => {
    const ref = pollingRef.current;
    return () => { Object.values(ref).forEach(clearInterval); };
  }, []);

  const handleVerifySources = async (agentId) => {
    setVerifyingAgentIds((prev) => new Set(prev).add(agentId));
    try {
      const res = await validateSources(agentId);
      const msg = res.data?.message || "Verification triggered";
      setVerifySuccess(msg);
      startPollingAgent(agentId);
    } catch (err) {
      const errMsg = err.response?.data?.error || "Failed to verify sources";
      setVerifySuccess(`⚠️ ${errMsg}`);
    } finally {
      setVerifyingAgentIds((prev) => {
        const next = new Set(prev);
        next.delete(agentId);
        return next;
      });
    }
  };

  const handleTriggerCrawl = async (agentId) => {
    setCrawlingAgentIds((prev) => new Set(prev).add(agentId));
    try {
      await triggerCrawl(agentId);
      setVerifySuccess("Crawl triggered — results will appear shortly");
      startPollingAgent(agentId);
    } catch (err) {
      const errMsg = err.response?.data?.error || "Failed to trigger crawl";
      setVerifySuccess(`⚠️ ${errMsg}`);
    } finally {
      setCrawlingAgentIds((prev) => {
        const next = new Set(prev);
        next.delete(agentId);
        return next;
      });
    }
  };

  if (dashLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <CircularProgress sx={{ color: ACCENT }} />
      </Box>
    );
  }

  // Derive tier info from dashboard API response (Task 6.1, 6.2)
  const subscription = dashData.subscription;
  const tierName = subscription?.name || "—";
  const subLimits = subscription?.limits || {};
  const subUsage = subscription?.usage || {};

  // Check if near limits — 80%+ of any limit (Task 6.4)
  const isNearLimit = (subLimits.sourcingAgents && subUsage.sourcingAgents >= subLimits.sourcingAgents * 0.8) ||
    (subLimits.creationAgents && subUsage.creationAgents >= subLimits.creationAgents * 0.8);

  const summary = dashData.summary || {};
  const agents = dashData.agents || [];

  // Check for paused agents due to downgrade (Task 6.5)
  const pausedAgents = agents.filter(a => a.healthStatus === "paused_limit_exceeded" || a.status === "paused_limit_exceeded");

  const tokenPoolMax = subLimits.tokenPool ?? 0;
  const tokenPoolUsed = summary.tokensUsedThisPeriod || 0;

  const metricCards = [
    { label: "Events Discovered", value: summary.totalEventsDiscoveredToday || 0, icon: EventNoteOutlinedIcon, color: "#4CAF50" },
    { label: "Drafts Pending", value: summary.totalDraftsPending || 0, icon: DraftsOutlinedIcon, color: ACCENT },
    { label: "Published Events", value: summary.totalPublished || 0, icon: PublishOutlinedIcon, color: "#7C4DFF" },
    { label: "Sources Monitored", value: agents.reduce((s, a) => s + (a.sourcesMonitored || 0), 0), icon: RadarOutlinedIcon, color: "#00BCD4" },
  ];

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1200, mx: "auto" }}>
      {/* Limit-exceeded banner (Task 6.5) */}
      {pausedAgents.length > 0 && (
        <Alert
          severity="warning"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate("/admin/settings/subscription")} sx={{ textTransform: "none", fontWeight: 700 }}>
              Upgrade Plan
            </Button>
          }
        >
          Some agents are paused because they exceed your current plan&apos;s limits. Upgrade your plan or remove agents to resume.
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, mb: 4, gap: 1 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: "#1D1B20", fontSize: { xs: "1.5rem", md: "2rem" } }}>
            AI Event Discovery Dashboard
          </Typography>
          <Typography sx={{ color: "#71727A", fontSize: 14, mt: 0.5 }}>
            Monitor your agents, review drafts, and track discovery activity.
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton onClick={fetchDashboard} size="small" disabled={dashLoading} sx={{ color: ACCENT }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
          <Chip label={tierName} sx={{ background: `${ACCENT}18`, color: ACCENT, fontWeight: 700, fontSize: 13, border: `1px solid ${ACCENT}40` }} />
          {isNearLimit && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => navigate("/admin/settings/subscription")}
              sx={{ textTransform: "none", fontWeight: 700, fontSize: 12, borderColor: ACCENT, color: ACCENT, borderRadius: 2, "&:hover": { borderColor: "#D4820F", background: `${ACCENT}08` } }}
            >
              Upgrade Plan
            </Button>
          )}
        </Box>
      </Box>

      {/* Usage vs Limits (Task 6.3) */}
      {subscription && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5, mb: 3 }}>
          <Chip
            size="small"
            label={`Sourcing Agents: ${subUsage.sourcingAgents ?? 0}/${subLimits.sourcingAgents === Infinity ? "∞" : (subLimits.sourcingAgents ?? "—")}`}
            sx={{ fontWeight: 600, fontSize: 12, background: "#F5F5F5", color: "#1D1B20" }}
          />
          <Chip
            size="small"
            label={`Creation Agents: ${subUsage.creationAgents ?? 0}/${subLimits.creationAgents === Infinity ? "∞" : (subLimits.creationAgents ?? "—")}`}
            sx={{ fontWeight: 600, fontSize: 12, background: "#F5F5F5", color: "#1D1B20" }}
          />
          {subLimits.tokenPool != null && (
            <Chip
              size="small"
              label={`Token Pool: ${formatTokenPool(tokenPoolUsed)}/${formatTokenPool(subLimits.tokenPool)}`}
              sx={{ fontWeight: 600, fontSize: 12, background: "#F5F5F5", color: "#1D1B20" }}
            />
          )}
        </Box>
      )}

      {dashError && <Alert severity="warning" sx={{ mb: 3 }}>{dashError}</Alert>}

      {/* Metric Cards */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {metricCards.map((metric) => {
          const Icon = metric.icon;
          return (
            <Grid item xs={6} md={3} key={metric.label}>
              <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", height: "100%", transition: "box-shadow 0.2s", "&:hover": { boxShadow: "0 4px 20px rgba(0,0,0,0.06)" } }}>
                <CardContent sx={{ p: 2.5 }}>
                  <Box sx={{ width: 40, height: 40, borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "center", background: `${metric.color}14`, mb: 1.5 }}>
                    <Icon sx={{ color: metric.color, fontSize: 22 }} />
                  </Box>
                  <Typography sx={{ fontSize: 28, fontWeight: 800, color: "#1D1B20", lineHeight: 1.2 }}>
                    {dashLoading ? "—" : metric.value}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "#71727A", fontWeight: 600, mt: 0.5 }}>
                    {metric.label}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Agents Section */}
      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <SmartToyOutlinedIcon sx={{ color: ACCENT, fontSize: 22 }} />
              <Typography sx={{ fontWeight: 700, color: "#1D1B20", fontSize: 16 }}>
                Agents
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddCircleOutlineIcon />}
              onClick={() => setCreateOpen(true)}
              sx={{ background: ACCENT, textTransform: "none", fontWeight: 700, borderRadius: 2, px: 2.5, "&:hover": { background: "#D4820F" } }}
            >
              Create Agent
            </Button>
          </Box>

          {dashLoading ? (
            <Box sx={{ textAlign: "center", py: 4 }}><CircularProgress size={28} sx={{ color: ACCENT }} /></Box>
          ) : agents.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 5, border: "1.5px dashed #E0E0E0", borderRadius: 2, background: "#FAFAFA" }}>
              <SmartToyOutlinedIcon sx={{ fontSize: 40, color: "#BDBDBD", mb: 1 }} />
              <Typography sx={{ color: "#71727A", fontWeight: 600, fontSize: 14 }}>No agents created yet</Typography>
              <Typography sx={{ color: "#9E9E9E", fontSize: 13, mt: 0.5 }}>Create your first sourcing agent to start discovering events automatically.</Typography>
            </Box>
          ) : (
            <Grid container spacing={2}>
              {agents.map((agent) => (
                <Grid item xs={12} sm={6} key={agent.agentId}>
                  <Card variant="outlined" sx={{ borderRadius: 2, p: 2, cursor: "pointer", "&:hover": { borderColor: ACCENT, boxShadow: "0 2px 12px rgba(240,153,37,0.1)" } }} onClick={() => {
                    // If agent belongs to a different business (org view), switch context first
                    const agentAccountId = agent.accountId || agent.PK?.replace('ACCOUNT#', '');
                    const currentBizId = sessionStorage.getItem("selectedBusinessId");
                    if (agentAccountId && agentAccountId !== currentBizId) {
                      sessionStorage.setItem("selectedBusinessId", agentAccountId);
                    }
                    navigate(`/admin/ai-agents/${agent.agentId}`);
                  }}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: 14, color: "#1D1B20" }}>{agent.agentName}</Typography>
                        <Typography sx={{ fontSize: 12, color: "#71727A" }}>{agent.agentType === "Sourcing_Agent" ? "Sourcing" : "Event Creation"}</Typography>
                      </Box>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }} onClick={(e) => e.stopPropagation()}>
                        <Chip size="small" label={agent.healthStatus} sx={{ fontSize: 11, fontWeight: 600, background: agent.healthStatus === "Active" ? "#E8F5E9" : agent.healthStatus === "Error" ? "#FFEBEE" : "#F5F5F5", color: agent.healthStatus === "Active" ? "#2E7D32" : agent.healthStatus === "Error" ? "#C62828" : "#757575" }} />
                        {agent.agentType === "Sourcing_Agent" && (
                          <IconButton
                            size="small"
                            onClick={() => handleVerifySources(agent.agentId)}
                            disabled={verifyingAgentIds.has(agent.agentId)}
                            sx={{ color: "#00BCD4", "&:hover": { color: "#00838F" } }}
                            title="Verify all sources"
                          >
                            {verifyingAgentIds.has(agent.agentId) ? <CircularProgress size={16} sx={{ color: "#00BCD4" }} /> : <FactCheckOutlinedIcon fontSize="small" />}
                          </IconButton>
                        )}
                        <IconButton
                          size="small"
                          onClick={() => handleTriggerCrawl(agent.agentId)}
                          disabled={crawlingAgentIds.has(agent.agentId)}
                          sx={{ color: "#7C4DFF", "&:hover": { color: "#5E35B1" } }}
                          title="Run crawl now"
                        >
                          {crawlingAgentIds.has(agent.agentId) ? <CircularProgress size={16} sx={{ color: "#7C4DFF" }} /> : <RocketLaunchOutlinedIcon fontSize="small" />}
                        </IconButton>
                        <IconButton size="small" onClick={() => handleToggleAgent(agent.agentId, agent.healthStatus)} sx={{ color: agent.healthStatus === "Active" ? "#F09925" : "#4CAF50" }} title={agent.healthStatus === "Active" ? "Pause agent" : "Activate agent"}>
                          {agent.healthStatus === "Active" ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                        </IconButton>
                        <IconButton size="small" onClick={() => confirmDelete(agent.agentId)} sx={{ ml: 1, color: "#BDBDBD", "&:hover": { color: "#E53935" } }}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                    <Box sx={{ display: "flex", gap: 2, mt: 1.5 }}>
                      {agent.agentType === "Sourcing_Agent" ? (
                        <>
                          <Box><Typography sx={{ fontSize: 16, fontWeight: 700 }}>{agent.sourcesMonitored || 0}</Typography><Typography sx={{ fontSize: 10, color: "#9E9E9E" }}>Found</Typography></Box>
                          <Box><Typography sx={{ fontSize: 16, fontWeight: 700 }}>{agent.sourcesVerified || 0}</Typography><Typography sx={{ fontSize: 10, color: "#9E9E9E" }}>Verified</Typography></Box>
                          <Box><Typography sx={{ fontSize: 16, fontWeight: 700 }}>{agent.sourcesPending || 0}</Typography><Typography sx={{ fontSize: 10, color: "#9E9E9E" }}>Pending</Typography></Box>
                        </>
                      ) : (
                        <>
                          <Box><Typography sx={{ fontSize: 16, fontWeight: 700 }}>{agent.draftsPendingReview || 0}</Typography><Typography sx={{ fontSize: 10, color: "#9E9E9E" }}>Drafts</Typography></Box>
                          <Box><Typography sx={{ fontSize: 16, fontWeight: 700 }}>{agent.publishedEventsCount || 0}</Typography><Typography sx={{ fontSize: 10, color: "#9E9E9E" }}>Published</Typography></Box>
                          <Box><Typography sx={{ fontSize: 16, fontWeight: 700 }}>{agent.eventsDiscoveredToday || 0}</Typography><Typography sx={{ fontSize: 10, color: "#9E9E9E" }}>Today</Typography></Box>
                        </>
                      )}
                    </Box>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </CardContent>
      </Card>

      {/* Recent Activity Section */}
      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8", mb: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <HistoryOutlinedIcon sx={{ color: ACCENT, fontSize: 22 }} />
            <Typography sx={{ fontWeight: 700, color: "#1D1B20", fontSize: 16 }}>Recent Activity</Typography>
          </Box>
          {agents.length === 0 || !agents.some((a) => a.lastCrawlTimestamp) ? (
            <Box sx={{ textAlign: "center", py: 5, border: "1.5px dashed #E0E0E0", borderRadius: 2, background: "#FAFAFA" }}>
              <HistoryOutlinedIcon sx={{ fontSize: 40, color: "#BDBDBD", mb: 1 }} />
              <Typography sx={{ color: "#71727A", fontWeight: 600, fontSize: 14 }}>No crawl activity yet</Typography>
              <Typography sx={{ color: "#9E9E9E", fontSize: 13, mt: 0.5 }}>Activity from your agents will appear here once they start running.</Typography>
            </Box>
          ) : (
            <Box>
              {agents.filter((a) => a.lastCrawlTimestamp).map((a) => (
                <Box key={a.agentId} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1.5, borderBottom: "1px solid #F5F5F5" }}>
                  <Box>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: "#1D1B20" }}>{a.agentName}</Typography>
                    <Typography sx={{ fontSize: 11, color: "#9E9E9E" }}>Last crawl: {new Date(a.lastCrawlTimestamp).toLocaleString()}</Typography>
                  </Box>
                  <Chip size="small" label={`${a.eventsDiscoveredToday} events`} sx={{ fontSize: 11, background: "#E8F5E9", color: "#2E7D32" }} />
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Tier Info / Usage */}
      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid #E8E8E8" }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: { xs: "flex-start", sm: "center" }, flexDirection: { xs: "column", sm: "row" }, mb: 2.5, gap: 1 }}>
            <Typography sx={{ fontWeight: 700, color: "#1D1B20", fontSize: 16 }}>Plan & Usage</Typography>
            <Button variant="outlined" size="small" onClick={() => navigate("/admin/settings/subscription")} sx={{ textTransform: "none", fontWeight: 700, borderColor: ACCENT, color: ACCENT, borderRadius: 2, "&:hover": { borderColor: "#D4820F", background: `${ACCENT}08` } }}>
              Manage Plan
            </Button>
          </Box>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#71727A", mb: 0.5 }}>Current Plan</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 800, color: ACCENT }}>{tierName}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#71727A", mb: 0.5 }}>Token Pool Usage</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1D1B20", mb: 0.75 }}>
                {formatTokenPool(tokenPoolUsed)} / {formatTokenPool(tokenPoolMax)}
              </Typography>
              <LinearProgress variant="determinate" value={tokenPoolMax > 0 && tokenPoolMax !== Infinity ? (tokenPoolUsed / tokenPoolMax) * 100 : 0} sx={{ height: 6, borderRadius: 3, background: "#EEEEEE", "& .MuiLinearProgress-bar": { borderRadius: 3, background: ACCENT } }} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#71727A", mb: 0.5 }}>Agent Limits</Typography>
              <Box sx={{ display: "flex", gap: 2 }}>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1D1B20" }}>{subLimits.sourcingAgents === Infinity ? "∞" : (subLimits.sourcingAgents ?? "—")}</Typography>
                  <Typography sx={{ fontSize: 11, color: "#71727A" }}>Sourcing</Typography>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: 14, fontWeight: 700, color: "#1D1B20" }}>{subLimits.creationAgents === Infinity ? "∞" : (subLimits.creationAgents ?? "—")}</Typography>
                  <Typography sx={{ fontSize: 11, color: "#71727A" }}>Creation</Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, color: "#C62828" }}>Delete Agent</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: "#1D1B20" }}>
            Are you sure you want to permanently delete this agent? This will remove all its configuration, sources, and history. This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteOpen(false)} sx={{ textTransform: "none", color: "#71727A" }}>Cancel</Button>
          <Button onClick={handleDeleteAgent} disabled={deleting} variant="contained" color="error" sx={{ textTransform: "none", fontWeight: 700 }}>
            {deleting ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Delete Permanently"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Agent Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create Agent</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}>
          {createError && <Alert severity="error" sx={{ mb: 1 }}>{createError}</Alert>}
          <Box sx={{ display: "flex", gap: 1.5 }}>
            {AGENT_TYPES.map((t) => (
              <Box
                key={t.value}
                onClick={() => setForm({ ...INITIAL_FORM, agentType: t.value, crawlSchedule: CRAWL_SCHEDULES[t.value][0] })}
                sx={{
                  flex: 1,
                  p: 2,
                  borderRadius: 2,
                  border: form.agentType === t.value ? "2px solid #F09925" : "1.5px solid #E0E0E0",
                  background: form.agentType === t.value ? "#FFF8F0" : "#fff",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  "&:hover": { borderColor: "#F09925", background: "#FFFAF5" },
                }}
              >
                <Typography sx={{ fontSize: 13, fontWeight: 700, color: form.agentType === t.value ? "#F09925" : "#1D1B20" }}>{t.label}</Typography>
                <Typography sx={{ fontSize: 11, color: "#71727A", mt: 0.5 }}>{t.description}</Typography>
              </Box>
            ))}
          </Box>
          <TextField label="Agent Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} fullWidth size="small" placeholder={form.agentType === "Sourcing_Agent" ? "e.g. Houston Concert Sources" : "e.g. Houston Event Publisher"} />

          {form.agentType === "Sourcing_Agent" ? (
            <>
              <Autocomplete
                multiple
                options={US_CITIES}
                value={form.cities}
                onChange={(_, newValue) => setForm({ ...form, cities: newValue.slice(0, 20) })}
                filterSelectedOptions
                size="small"
                renderInput={(params) => <TextField {...params} label="Cities" placeholder="Search cities..." size="small" />}
                ChipProps={{ size: "small", sx: { fontWeight: 600 } }}
                limitTags={5}
                noOptionsText="No matching cities"
              />
              <Autocomplete
                multiple
                options={EVENT_CATEGORIES}
                value={form.categories}
                onChange={(_, newValue) => setForm({ ...form, categories: newValue })}
                filterSelectedOptions
                size="small"
                renderInput={(params) => <TextField {...params} label="Categories" placeholder="Select categories..." size="small" />}
                ChipProps={{ size: "small", sx: { fontWeight: 600 } }}
                noOptionsText="No matching categories"
              />
              <TextField label="Keywords (comma-separated)" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} fullWidth size="small" placeholder="live music, outdoor, free" />
            </>
          ) : (
            <>
              <Autocomplete
                options={(dashData.agents || []).filter((a) => a.agentType === "Sourcing_Agent")}
                getOptionLabel={(opt) => opt.agentName || opt.name || ""}
                value={(dashData.agents || []).find((a) => a.agentId === form.linkedSourcingAgentId) || null}
                onChange={(_, newValue) => setForm({ ...form, linkedSourcingAgentId: newValue?.agentId || "" })}
                size="small"
                renderInput={(params) => <TextField {...params} label="Sourcing Agent" placeholder="Select a sourcing agent..." size="small" />}
                noOptionsText="No sourcing agents — create one first"
              />
              <Autocomplete
                options={businessData || []}
                getOptionLabel={(opt) => {
                  const name = opt.businessName || opt.name || opt.linkedBusinessId || "";
                  return opt.orgName ? `${name} — ${opt.orgName}` : name;
                }}
                value={(businessData || []).find((b) => (b.linkedBusinessId || b.businessId || b.id) === form.businessId) || null}
                onChange={(_, newValue) => setForm({ ...form, businessId: newValue?.linkedBusinessId || newValue?.businessId || newValue?.id || "" })}
                size="small"
                renderInput={(params) => <TextField {...params} label="Target Business" placeholder="Search businesses..." size="small" />}
                noOptionsText="No businesses found"
                isOptionEqualToValue={(opt, val) => (opt.linkedBusinessId || opt.businessId || opt.id) === (val.linkedBusinessId || val.businessId || val.id)}
              />
            </>
          )}

          <TextField select label="Crawl Schedule" value={form.crawlSchedule} onChange={(e) => setForm({ ...form, crawlSchedule: e.target.value })} fullWidth size="small">
            {(CRAWL_SCHEDULES[form.agentType] || []).map((s) => <MenuItem key={s} value={s}>{SCHEDULE_LABELS[s] || s}</MenuItem>)}
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ textTransform: "none", color: "#71727A" }}>Cancel</Button>
          <Button onClick={handleCreateAgent} disabled={creating || !form.name.trim() || (form.agentType === "Sourcing_Agent" ? (form.cities.length === 0 || form.categories.length === 0) : !form.linkedSourcingAgentId)} variant="contained" sx={{ background: ACCENT, textTransform: "none", fontWeight: 700, "&:hover": { background: "#D4820F" } }}>
            {creating ? <CircularProgress size={20} sx={{ color: "#fff" }} /> : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Verify Sources Success Snackbar */}
      <Snackbar
        open={!!verifySuccess}
        autoHideDuration={5000}
        onClose={() => setVerifySuccess(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        message={verifySuccess}
      />
    </Box>
  );
};

export default AiAgentDashboard;
