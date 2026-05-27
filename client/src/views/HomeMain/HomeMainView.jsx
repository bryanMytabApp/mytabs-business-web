import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getBusiness, updateBusiness, getBusinessActivities } from "../../services/businessService";
import { getEventsByUserId } from "../../services/eventService";
import { getBusinessAnalytics, getEventPTACount } from "../../services/analyticsService";
import { parseJwt } from "../../utils/common";

const EVENT_COLORS = ["#f97316", "#4dd9e0", "#a78bfa", "#34d399", "#f59e0b"];

const DEFAULT_GOALS = { followers: 100, events: 10, pta: 50 };

// Activity types configuration
const ACTIVITY_TYPES = [
  { type: 'event_created', icon: '📅', label: 'Event Created', color: '#f97316' },
  { type: 'event_updated', icon: '✏️', label: 'Event Updated', color: '#4dd9e0' },
  { type: 'event_published', icon: '🚀', label: 'Event Published', color: '#34d399' },
  { type: 'event_cancelled', icon: '❌', label: 'Event Cancelled', color: '#e8445a' },
  { type: 'member_added', icon: '👤', label: 'Member Added', color: '#a78bfa' },
  { type: 'member_removed', icon: '👤', label: 'Member Removed', color: '#94a3b8' },
  { type: 'role_changed', icon: '🔑', label: 'Role Changed', color: '#f59e0b' },
  { type: 'new_follower', icon: '💜', label: 'New Follower', color: '#a78bfa' },
  { type: 'follower_milestone', icon: '🎉', label: 'Follower Milestone', color: '#f97316' },
  { type: 'new_pta', icon: '✓', label: 'New PTA', color: '#34d399' },
  { type: 'ticket_sold', icon: '🎟️', label: 'Ticket Sold', color: '#4dd9e0' },
  { type: 'profile_updated', icon: '⊞', label: 'Profile Updated', color: '#4dd9e0' },
  { type: 'photo_added', icon: '📷', label: 'Photo Added', color: '#a78bfa' },
  { type: 'menu_updated', icon: '🍽️', label: 'Menu Updated', color: '#f59e0b' },
  { type: 'goal_achieved', icon: '🏆', label: 'Goal Achieved', color: '#f97316' },
];

const DEFAULT_ACTIVITY_SETTINGS = {
  enabledTypes: ACTIVITY_TYPES.map(t => t.type), // All enabled by default
  displayCount: 5, // Show 5 items by default
};

const QUICK_ACTIONS = [
  { icon: "✦", label: "Create Ad", color: "#f97316", bg: "rgba(249,115,22,0.15)", path: "/admin/my-events" },
  { icon: "⊞", label: "Edit Business", color: "#4dd9e0", bg: "rgba(77,217,224,0.15)", path: "/admin/my-business#profile" },
  { icon: "◈", label: "View Analytics", color: "#a78bfa", bg: "rgba(167,139,250,0.15)", path: "/admin/analytics" },
  { icon: "⬆", label: "Upload Photos", color: "#34d399", bg: "rgba(52,211,153,0.15)", path: "/admin/my-business#gallery" },
  { icon: "≡", label: "Edit Menu", color: "#f59e0b", bg: "rgba(245,158,11,0.15)", path: "/admin/my-business#menus" },
];

function useCountUp(target, duration = 1600, delay = 0) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = null, raf;
    const timeout = setTimeout(() => {
      const step = (ts) => {
        if (!start) start = ts;
        const p = Math.min((ts - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(ease * target));
        if (p < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }, delay);
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf); };
  }, [target, duration, delay]);
  return val;
}

function StatCard({ icon, value, label, color, delay }) {
  const count = useCountUp(value, 1600, delay);
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.52)",
        backdropFilter: "blur(20px)",
        border: `1px solid ${hovered ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)"}`,
        borderRadius: 20, padding: "24px 28px", flex: "1 1 140px",
        cursor: "default", transition: "all 0.3s cubic-bezier(.23,1,.32,1)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered ? "0 16px 48px rgba(0,0,0,0.12)" : "0 4px 20px rgba(0,0,0,0.07)",
        position: "relative", overflow: "hidden",
      }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${color}, transparent)`, borderRadius: "20px 20px 0 0" }} />
      <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontSize: 38, fontWeight: 900, color: "#0d1b35", lineHeight: 1, fontFamily: "'Nunito', sans-serif" }}>{count}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#4a6080", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 6, fontFamily: "'Nunito', sans-serif" }}>{label}</div>
    </div>
  );
}

function EventRow({ event, index, color, onClick }) {
  const [hovered, setHovered] = useState(false);
  const now = new Date();
  const startDate = new Date(event.startDate || event.date);
  const endDate = event.endDate ? new Date(event.endDate) : null;
  
  const day = startDate.toLocaleDateString("en-US", { weekday: "short" });
  const dayNum = startDate.getDate();
  const month = startDate.toLocaleDateString("en-US", { month: "short" });

  // Determine event status
  const isLive = now >= startDate && (!endDate || now <= endDate);
  const isPast = endDate ? now > endDate : now > startDate;
  
  // Calculate days until event
  const daysUntil = Math.ceil((startDate - now) / (1000 * 60 * 60 * 24));
  
  // Status display
  let statusDot, statusText, statusColor;
  if (isLive) {
    statusDot = "#34d399";
    statusText = "LIVE";
    statusColor = "#34d399";
  } else if (isPast) {
    statusDot = "#94a3b8";
    statusText = "ENDED";
    statusColor = "#94a3b8";
  } else if (daysUntil === 0) {
    statusDot = "#f97316";
    statusText = "TODAY";
    statusColor = "#f97316";
  } else if (daysUntil === 1) {
    statusDot = "#f59e0b";
    statusText = "TOMORROW";
    statusColor = "#f59e0b";
  } else if (daysUntil <= 7) {
    statusDot = "#4dd9e0";
    statusText = `${daysUntil} DAYS`;
    statusColor = "#4dd9e0";
  } else {
    statusDot = "#a78bfa";
    statusText = `${daysUntil} DAYS`;
    statusColor = "#a78bfa";
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 16, padding: "16px 20px",
        background: hovered ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.45)",
        backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.6)",
        borderRadius: 16, cursor: "pointer", transition: "all 0.25s ease",
        transform: hovered ? "translateX(4px)" : "translateX(0)",
      }}>
      <div style={{ textAlign: "center", minWidth: 48, background: color, borderRadius: 12, padding: "6px 8px" }}>
        <div style={{ fontSize: 9, fontWeight: 800, color: "rgba(255,255,255,0.85)", letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'Nunito', sans-serif" }}>{day}</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: "white", lineHeight: 1.1, fontFamily: "'Nunito', sans-serif" }}>{dayNum}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="hmv-event-name" style={{ fontSize: 15, fontWeight: 800, color: "#0d1b35", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Nunito', sans-serif" }}>{event.name}</div>
        <div style={{ fontSize: 12, color: "#4a6080", fontWeight: 600, marginTop: 2, fontFamily: "'Nunito', sans-serif" }}>{month} {dayNum}</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: statusDot, boxShadow: isLive ? `0 0 8px ${statusDot}` : "none", animation: isLive ? "pulse 2s infinite" : "none" }} />
        <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, fontFamily: "'Nunito', sans-serif" }}>{statusText}</span>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#4a6080", letterSpacing: "0.08em", fontFamily: "'Nunito', sans-serif" }}>PTA</div>
        <div style={{ fontSize: 16, fontWeight: 900, color: color, fontFamily: "'Nunito', sans-serif" }}>{event.ptaCount || 0}</div>
      </div>
      <div style={{ color: "#4a6080", fontSize: 14 }}>›</div>
    </div>
  );
}

const HomeMainView = () => {
  const navigate = useNavigate();
  const [, setLoading] = useState(true);
  const [businessName, setBusinessName] = useState("");
  const [businessData, setBusinessData] = useState(null);
  const [metrics, setMetrics] = useState({ totalEvents: 0, activeEvents: 0, followers: 0, totalPTA: 0 });
  const [goals, setGoals] = useState(DEFAULT_GOALS);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activitySettings, setActivitySettings] = useState(DEFAULT_ACTIVITY_SETTINGS);
  const [showActivitySettingsModal, setShowActivitySettingsModal] = useState(false);
  const [editingActivitySettings, setEditingActivitySettings] = useState(DEFAULT_ACTIVITY_SETTINGS);
  const [savingActivitySettings, setSavingActivitySettings] = useState(false);
  const [time, setTime] = useState(new Date());
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [editingGoals, setEditingGoals] = useState(DEFAULT_GOALS);
  const [savingGoals, setSavingGoals] = useState(false);

  const idToken = localStorage.getItem("idToken");
  const userId = idToken ? parseJwt(idToken) : null;

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (userId) fetchDashboardData(); }, [userId]);

  const handleSaveGoals = async () => {
    if (!businessData) return;
    setSavingGoals(true);
    try {
      await updateBusiness({
        ...businessData,
        performanceGoals: editingGoals,
      });
      setGoals(editingGoals);
      setShowGoalsModal(false);
    } catch (err) {
      console.error("Error saving goals:", err);
      alert("Failed to save goals. Please try again.");
    } finally {
      setSavingGoals(false);
    }
  };

  const handleSaveActivitySettings = async () => {
    if (!businessData) return;
    setSavingActivitySettings(true);
    try {
      await updateBusiness({
        ...businessData,
        activitySettings: editingActivitySettings,
      });
      setActivitySettings(editingActivitySettings);
      setShowActivitySettingsModal(false);
    } catch (err) {
      console.error("Error saving activity settings:", err);
      alert("Failed to save settings. Please try again.");
    } finally {
      setSavingActivitySettings(false);
    }
  };

  const toggleActivityType = (type) => {
    setEditingActivitySettings(prev => {
      const enabled = prev.enabledTypes.includes(type);
      return {
        ...prev,
        enabledTypes: enabled
          ? prev.enabledTypes.filter(t => t !== type)
          : [...prev.enabledTypes, type]
      };
    });
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      console.log("📊 Dashboard: fetching data for userId:", userId);

      // Fetch business + events in parallel for speed
      const savedBizId = sessionStorage.getItem("selectedBusinessId");
      console.log("📊 Dashboard: using selectedBusinessId from sessionStorage:", savedBizId);
      const [businessRes, eventsRes] = await Promise.all([
        getBusiness(userId, savedBizId || undefined).catch((err) => { console.error("❌ Dashboard: getBusiness failed:", err); return null; }),
        getEventsByUserId(userId).catch(() => ({ data: [] })),
      ]);

      console.log("📊 Dashboard: getBusiness response:", businessRes?.data);

      // Resolve business — getBusiness(userId) checks User_Business_Access table
      // for org members and falls back to direct ownership lookup
      let resolvedBusiness = businessRes?.data;
      
      // If the response is an array (multiple businesses), use the first one
      if (Array.isArray(resolvedBusiness)) {
        console.log("📊 Dashboard: multiple businesses returned:", resolvedBusiness.length);
        resolvedBusiness = resolvedBusiness[0];
      }
      console.log("📊 Dashboard: resolved business name:", resolvedBusiness?.name);
      setBusinessName(resolvedBusiness?.name || "Your Business");
      setBusinessData(resolvedBusiness);
      
      // Load saved performance goals
      if (resolvedBusiness?.performanceGoals) {
        setGoals(resolvedBusiness.performanceGoals);
        setEditingGoals(resolvedBusiness.performanceGoals);
      }
      
      // Load saved activity settings
      if (resolvedBusiness?.activitySettings) {
        setActivitySettings(resolvedBusiness.activitySettings);
        setEditingActivitySettings(resolvedBusiness.activitySettings);
      }

      const events = eventsRes.data || [];
      // Filter events to only those belonging to the selected business.
      // Events without a businessId are "untagged" and belong to the owner's
      // PRIMARY business (the one with userId as partition key, not linked businesses).
      // We determine the primary biz by fetching without a businessId param.
      let primaryBizId = null;
      try {
        const primaryRes = await getBusiness(userId);
        primaryBizId = primaryRes?.data?._id || null;
      } catch (e) { /* ignore */ }

      const filteredEvents = savedBizId
        ? events.filter(e => {
            if (e.businessId === savedBizId) return true;
            // Untagged events only belong to the primary business
            if (!e.businessId && savedBizId === primaryBizId) return true;
            return false;
          })
        : events;
      const now = new Date();
      // Older events use the `date` field; newer ones (created via the v2
      // wizard) use `startDate`. Fall back through both so events from
      // either schema are picked up. Without this, multi-step events would
      // silently disappear from the "Upcoming" rail.
      const eventStart = (e) => {
        const raw = e?.startDate || e?.date || e?.endDate;
        const d = raw ? new Date(raw) : null;
        return d && !isNaN(d) ? d : null;
      };
      const allUpcoming = filteredEvents
        .filter((e) => {
          const start = eventStart(e);
          return start && start >= now;
        })
        .sort((a, b) => eventStart(a) - eventStart(b));
      const upcomingForDisplay = allUpcoming.slice(0, 3);

      // Set metrics and show page immediately (don't wait for PTA)
      let followersCount = resolvedBusiness?.followersCount || 0;
      setMetrics({ totalEvents: filteredEvents.length, activeEvents: allUpcoming.length, followers: followersCount, totalPTA: 0 });
      setUpcomingEvents(upcomingForDisplay.map(e => ({ ...e, ptaCount: 0 })));
      setLoading(false);

      // Fetch PTA counts, analytics, and activities in background (non-blocking)
      Promise.all([
        getBusinessAnalytics(userId).catch(() => null),
        ...upcomingForDisplay.map(event => getEventPTACount(event._id).catch(() => null)),
      ]).then(([analyticsRes, ...ptaResults]) => {
        const totalPTA = analyticsRes?.data?.totalPTA || 0;
        setMetrics(prev => ({ ...prev, totalPTA }));
        setUpcomingEvents(upcomingForDisplay.map((event, i) => ({
          ...event,
          ptaCount: ptaResults[i]?.data?.count || 0,
        })));
      });

      // Fetch recent activities for the business
      if (userId) {
        getBusinessActivities(userId).then(activitiesRes => {
          if (activitiesRes?.data?.activities) {
            setActivities(activitiesRes.data.activities);
          }
        }).catch(err => {
          console.error("Error fetching activities:", err);
        });
      }

    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setLoading(false);
    }
  };

  // The Router's Suspense fallback already shows a single page-level spinner
  // while this chunk loads. Avoid showing a second spinner here; render the
  // shell immediately and let individual sections fill in as their data
  // arrives. This eliminates the "two loaders in a row" experience.


  return (
    <div className="hmv-wrap" style={{ minHeight: "100vh", fontFamily: "'Nunito', sans-serif", background: "linear-gradient(135deg, #e8f4fd 0%, #dbeeff 35%, #f0f8ff 65%, #e2eeff 100%)", overflowX: "hidden", overflowY: "auto", padding: "28px 32px", display: "flex", flexDirection: "column", alignItems: "center" }}>
    <div className="hmv-inner" style={{ maxWidth: "1200px", width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900;1000&display=swap');
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .action-btn { transition: all 0.25s cubic-bezier(.23,1,.32,1); }
        .action-btn:hover { transform: translateY(-3px) scale(1.04); }
        @media(max-width:768px) { .hmv-clock-avatar { display: none !important; } }
        @media(max-width:768px) { .hmv-event-name { font-size: 13px !important; } }
        @media(max-width:768px) { .hmv-stats { display: grid !important; grid-template-columns: 1fr 1fr !important; } }
        @media(max-width:768px) { .hmv-actions { display: grid !important; grid-template-columns: 1fr 1fr !important; } }
        @media(max-width:768px) { .hmv-two-col { grid-template-columns: 1fr !important; } }
        @media(max-width:768px) { .hmv-wrap { padding: 16px !important; } .hmv-inner { max-width: 100% !important; width: 100% !important; overflow: hidden; } }
      `}</style>

      {/* ── TOPBAR ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", animation: "fadeIn 0.6s ease both" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(13,27,53,0.55)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 4 }}>
            {time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </div>
          <h1 style={{ fontSize: "clamp(22px,3vw,32px)", fontWeight: 1000, color: "#0d1b35", lineHeight: 1.1, textShadow: "0 1px 4px rgba(0,0,0,0.15)", margin: 0 }}>
            Welcome back, <span style={{ color: "#f97316" }}>{businessName}</span> 🎉
          </h1>
          <p style={{ fontSize: 14, color: "#2a4a6e", fontWeight: 600, marginTop: 4 }}>Here's what's happening with your business</p>
        </div>
        <div className="hmv-clock-avatar" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ background: "rgba(255,255,255,0.5)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.65)", borderRadius: 14, padding: "10px 18px", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#0d1b35", letterSpacing: "0.05em" }}>
              {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div style={{ fontSize: 10, color: "#4a6080", fontWeight: 700, letterSpacing: "0.1em" }}>LIVE</div>
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: "linear-gradient(135deg,#f97316,#fb923c)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 17, color: "white", boxShadow: "0 4px 14px rgba(249,115,22,0.4)", cursor: "pointer" }}>
            {businessName?.[0]?.toUpperCase() || "U"}
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <div className="hmv-stats" style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <StatCard icon="📅" value={metrics.totalEvents} label="Total Events" color="#4dd9e0" delay={100} />
        <StatCard icon="🔥" value={metrics.activeEvents} label="Active Events" color="#f97316" delay={200} />
        <StatCard icon="👥" value={metrics.followers} label="Followers" color="#a78bfa" delay={300} />
        <StatCard icon="✓" value={metrics.totalPTA} label="Total PTA" color="#34d399" delay={400} />
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div style={{ background: "rgba(255,255,255,0.45)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.65)", borderRadius: 22, padding: "22px 24px", animation: "slideIn 0.5s 0.2s both" }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: "#2a4a6e", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>Quick Actions</div>
        <div className="hmv-actions" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {QUICK_ACTIONS.map((a, i) => (
            <button key={i} className="action-btn" onClick={() => navigate(a.path)}
              style={{
                flex: "1 1 120px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                gap: 10, padding: "18px 12px", borderRadius: 16, border: `1px solid ${a.color}20`,
                background: a.bg, cursor: "pointer", fontFamily: "'Nunito', sans-serif",
                boxShadow: "none",
              }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: a.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "white" }}>
                {a.icon}
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: "#0d1b35" }}>{a.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── BOTTOM GRID: Events + Activity ── */}
      <div className="hmv-two-col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, flex: 1 }}>

        {/* Upcoming Events */}
        <div style={{ background: "rgba(255,255,255,0.45)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.65)", borderRadius: 22, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#2a4a6e", letterSpacing: "0.14em", textTransform: "uppercase" }}>Upcoming Events</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#34d399", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#34d399" }}>{metrics.activeEvents} Active</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {upcomingEvents.length > 0 ? (
              upcomingEvents.map((ev, i) => <EventRow key={ev._id} event={ev} index={i} color={EVENT_COLORS[i % EVENT_COLORS.length]} onClick={() => navigate(`/admin/my-events/${ev._id}`)} />)
            ) : (
              <div style={{ textAlign: "center", padding: "24px", color: "#4a6080", fontSize: 14, fontWeight: 600 }}>
                No upcoming events
              </div>
            )}
          </div>
          <button
            onClick={() => navigate("/admin/my-events/create")}
            style={{ width: "100%", padding: "12px", borderRadius: 14, background: "rgba(13,27,53,0.07)", border: "1.5px dashed rgba(13,27,53,0.2)", color: "#2a4a6e", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "'Nunito', sans-serif", transition: "all 0.2s" }}
            onMouseEnter={e => e.target.style.background = "rgba(13,27,53,0.12)"}
            onMouseLeave={e => e.target.style.background = "rgba(13,27,53,0.07)"}>
            + Create New Event
          </button>
        </div>

        {/* Right column: Activity + mini analytics */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Mini analytics bar */}
          <div style={{ background: "rgba(255,255,255,0.45)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.65)", borderRadius: 22, padding: "22px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#2a4a6e", letterSpacing: "0.14em", textTransform: "uppercase" }}>Performance Goals</div>
              <button
                onClick={() => { setEditingGoals(goals); setShowGoalsModal(true); }}
                style={{ background: "rgba(249,115,22,0.15)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, color: "#f97316", cursor: "pointer", fontFamily: "'Nunito', sans-serif", transition: "all 0.2s" }}
                onMouseEnter={e => e.target.style.background = "rgba(249,115,22,0.25)"}
                onMouseLeave={e => e.target.style.background = "rgba(249,115,22,0.15)"}>
                ✎ Edit Goals
              </button>
            </div>
            {[
              { label: "Followers Goal", used: metrics.followers, total: goals.followers, color: "#a78bfa" },
              { label: "Events Goal", used: metrics.totalEvents, total: goals.events, color: "#f97316" },
              { label: "PTA Goal", used: metrics.totalPTA, total: goals.pta, color: "#4dd9e0" },
            ].map((b, i) => (
              <div key={i} style={{ marginBottom: i < 2 ? 14 : 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0d1b35" }}>{b.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: b.color }}>{b.used}/{b.total}</span>
                </div>
                <div style={{ height: 8, background: "rgba(13,27,53,0.08)", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 8,
                    background: `linear-gradient(90deg, ${b.color}, ${b.color}99)`,
                    width: `${Math.min((b.used / b.total) * 100, 100)}%`,
                    transition: "width 1.2s cubic-bezier(.23,1,.32,1)",
                    boxShadow: `0 0 8px ${b.color}66`,
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Recent Activity */}
          <div style={{ background: "rgba(255,255,255,0.45)", backdropFilter: "blur(20px)", border: "1px solid rgba(255,255,255,0.65)", borderRadius: 22, padding: "22px 24px", flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#2a4a6e", letterSpacing: "0.14em", textTransform: "uppercase" }}>Recent Activity</div>
              <button
                onClick={() => { setEditingActivitySettings(activitySettings); setShowActivitySettingsModal(true); }}
                style={{ background: "rgba(167,139,250,0.15)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 11, fontWeight: 700, color: "#a78bfa", cursor: "pointer", fontFamily: "'Nunito', sans-serif", transition: "all 0.2s" }}
                onMouseEnter={e => e.target.style.background = "rgba(167,139,250,0.25)"}
                onMouseLeave={e => e.target.style.background = "rgba(167,139,250,0.15)"}>
                ✎ Settings
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(() => {
                // Filter activities based on settings
                const filteredActivities = activities.filter(a => activitySettings.enabledTypes.includes(a.type));
                const displayActivities = filteredActivities.slice(0, activitySettings.displayCount);
                
                if (displayActivities.length > 0) {
                  return displayActivities.map((activity, i) => {
                    // Format relative time
                    const activityDate = new Date(activity.timestamp);
                    const now = new Date();
                    const diffMs = now - activityDate;
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);
                    
                    let timeAgo;
                    if (diffMins < 1) timeAgo = "Just now";
                    else if (diffMins < 60) timeAgo = `${diffMins}m ago`;
                    else if (diffHours < 24) timeAgo = `${diffHours}h ago`;
                    else if (diffDays < 7) timeAgo = `${diffDays}d ago`;
                    else timeAgo = activityDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });

                    return (
                      <div key={activity.timestamp + i} style={{
                        display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                        background: "rgba(255,255,255,0.38)", backdropFilter: "blur(12px)",
                        border: "1px solid rgba(255,255,255,0.55)", borderRadius: 14,
                      }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${activity.color || '#4dd9e0'}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{activity.icon || '📋'}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0d1b35", fontFamily: "'Nunito', sans-serif" }}>{activity.message}</div>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#4a6080", whiteSpace: "nowrap", fontFamily: "'Nunito', sans-serif" }}>{timeAgo}</div>
                      </div>
                    );
                  });
                } else {
                  // Fallback to summary items when no activities yet
                  return [
                    { icon: "👥", text: `${metrics.followers} people are following your business`, time: "Today", type: "follow" },
                    { icon: "📅", text: `You have ${metrics.activeEvents} active events`, time: "Today", type: "event" },
                    { icon: "💡", text: "Tip: Create an event to see activity here", time: "Tip", type: "tip" },
                  ].map((item, i) => {
                    const colors = { follow: "#4dd9e0", event: "#f97316", tip: "#a78bfa" };
                    const c = colors[item.type];
                    return (
                      <div key={i} style={{
                        display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                        background: "rgba(255,255,255,0.38)", backdropFilter: "blur(12px)",
                        border: "1px solid rgba(255,255,255,0.55)", borderRadius: 14,
                      }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${c}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{item.icon}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#0d1b35", fontFamily: "'Nunito', sans-serif" }}>{item.text}</div>
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#4a6080", whiteSpace: "nowrap", fontFamily: "'Nunito', sans-serif" }}>{item.time}</div>
                      </div>
                    );
                  });
                }
              })()}
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 8 }} />

      {/* Goals Modal */}
      {showGoalsModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          animation: "fadeIn 0.2s ease"
        }} onClick={() => setShowGoalsModal(false)}>
          <div style={{
            background: "white", borderRadius: 24, padding: "32px", width: "100%", maxWidth: 420,
            boxShadow: "0 24px 80px rgba(0,0,0,0.2)", animation: "slideIn 0.3s ease"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0d1b35", margin: 0, fontFamily: "'Nunito', sans-serif" }}>
                Set Performance Goals
              </h2>
              <button onClick={() => setShowGoalsModal(false)} style={{
                background: "none", border: "none", fontSize: 24, color: "#94a3b8", cursor: "pointer", padding: 4
              }}>×</button>
            </div>
            
            <p style={{ fontSize: 14, color: "#4a6080", marginBottom: 24, fontFamily: "'Nunito', sans-serif" }}>
              Set your business goals to track progress on the dashboard.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Followers Goal */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0d1b35", marginBottom: 8, fontFamily: "'Nunito', sans-serif" }}>
                  👥 Followers Goal
                </label>
                <input
                  type="number"
                  value={editingGoals.followers}
                  onChange={e => setEditingGoals(prev => ({ ...prev, followers: parseInt(e.target.value) || 0 }))}
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 12, border: "2px solid #e2e8f0",
                    fontSize: 16, fontWeight: 600, fontFamily: "'Nunito', sans-serif", outline: "none",
                    transition: "border-color 0.2s"
                  }}
                  onFocus={e => e.target.style.borderColor = "#a78bfa"}
                  onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, fontFamily: "'Nunito', sans-serif" }}>
                  Current: {metrics.followers} followers
                </div>
              </div>

              {/* Events Goal */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0d1b35", marginBottom: 8, fontFamily: "'Nunito', sans-serif" }}>
                  📅 Events Goal
                </label>
                <input
                  type="number"
                  value={editingGoals.events}
                  onChange={e => setEditingGoals(prev => ({ ...prev, events: parseInt(e.target.value) || 0 }))}
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 12, border: "2px solid #e2e8f0",
                    fontSize: 16, fontWeight: 600, fontFamily: "'Nunito', sans-serif", outline: "none",
                    transition: "border-color 0.2s"
                  }}
                  onFocus={e => e.target.style.borderColor = "#f97316"}
                  onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, fontFamily: "'Nunito', sans-serif" }}>
                  Current: {metrics.totalEvents} events
                </div>
              </div>

              {/* PTA Goal */}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0d1b35", marginBottom: 8, fontFamily: "'Nunito', sans-serif" }}>
                  ✓ PTA (Plan to Attend) Goal
                </label>
                <input
                  type="number"
                  value={editingGoals.pta}
                  onChange={e => setEditingGoals(prev => ({ ...prev, pta: parseInt(e.target.value) || 0 }))}
                  style={{
                    width: "100%", padding: "12px 16px", borderRadius: 12, border: "2px solid #e2e8f0",
                    fontSize: 16, fontWeight: 600, fontFamily: "'Nunito', sans-serif", outline: "none",
                    transition: "border-color 0.2s"
                  }}
                  onFocus={e => e.target.style.borderColor = "#4dd9e0"}
                  onBlur={e => e.target.style.borderColor = "#e2e8f0"}
                />
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, fontFamily: "'Nunito', sans-serif" }}>
                  Current: {metrics.totalPTA} total PTA
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 28 }}>
              <button
                onClick={() => setShowGoalsModal(false)}
                style={{
                  flex: 1, padding: "14px", borderRadius: 12, border: "2px solid #e2e8f0", background: "white",
                  fontSize: 14, fontWeight: 700, color: "#4a6080", cursor: "pointer", fontFamily: "'Nunito', sans-serif",
                  transition: "all 0.2s"
                }}>
                Cancel
              </button>
              <button
                onClick={handleSaveGoals}
                disabled={savingGoals}
                style={{
                  flex: 1, padding: "14px", borderRadius: 12, border: "none",
                  background: savingGoals ? "#94a3b8" : "linear-gradient(135deg, #f97316, #fb923c)",
                  fontSize: 14, fontWeight: 700, color: "white", cursor: savingGoals ? "not-allowed" : "pointer",
                  fontFamily: "'Nunito', sans-serif", boxShadow: "0 4px 14px rgba(249,115,22,0.3)",
                  transition: "all 0.2s"
                }}>
                {savingGoals ? "Saving..." : "Save Goals"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity Settings Modal */}
      {showActivitySettingsModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
          animation: "fadeIn 0.2s ease"
        }} onClick={() => setShowActivitySettingsModal(false)}>
          <div style={{
            background: "white", borderRadius: 24, padding: "32px", width: "100%", maxWidth: 480,
            maxHeight: "90vh", overflowY: "auto",
            boxShadow: "0 24px 80px rgba(0,0,0,0.2)", animation: "slideIn 0.3s ease"
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 900, color: "#0d1b35", margin: 0, fontFamily: "'Nunito', sans-serif" }}>
                Activity Settings
              </h2>
              <button onClick={() => setShowActivitySettingsModal(false)} style={{
                background: "none", border: "none", fontSize: 24, color: "#94a3b8", cursor: "pointer", padding: 4
              }}>×</button>
            </div>
            
            <p style={{ fontSize: 14, color: "#4a6080", marginBottom: 24, fontFamily: "'Nunito', sans-serif" }}>
              Choose which activity types to show and how many items to display.
            </p>

            {/* Display Count */}
            <div style={{ marginBottom: 24 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#0d1b35", marginBottom: 8, fontFamily: "'Nunito', sans-serif" }}>
                Number of items to show
              </label>
              <select
                value={editingActivitySettings.displayCount}
                onChange={e => setEditingActivitySettings(prev => ({ ...prev, displayCount: parseInt(e.target.value) }))}
                style={{
                  width: "100%", padding: "12px 16px", borderRadius: 12, border: "2px solid #e2e8f0",
                  fontSize: 14, fontWeight: 600, fontFamily: "'Nunito', sans-serif", outline: "none",
                  cursor: "pointer", background: "white", color: "#0d1b35"
                }}>
                {[3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                  <option key={num} value={num}>{num} items</option>
                ))}
              </select>
            </div>

            {/* Activity Types - Clean Multi-select */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#0d1b35", fontFamily: "'Nunito', sans-serif" }}>
                  Activity types to show
                </label>
                <button
                  onClick={() => {
                    const allEnabled = editingActivitySettings.enabledTypes.length === ACTIVITY_TYPES.length;
                    setEditingActivitySettings(prev => ({
                      ...prev,
                      enabledTypes: allEnabled ? [] : ACTIVITY_TYPES.map(t => t.type)
                    }));
                  }}
                  style={{
                    background: "none", border: "none", fontSize: 11, fontWeight: 700,
                    color: "#6366f1", cursor: "pointer", fontFamily: "'Nunito', sans-serif"
                  }}>
                  {editingActivitySettings.enabledTypes.length === ACTIVITY_TYPES.length ? "Clear all" : "Select all"}
                </button>
              </div>
              
              {/* Selected tags */}
              <div style={{ 
                minHeight: 48, padding: "8px 12px", borderRadius: 12, border: "2px solid #e2e8f0",
                background: "white", marginBottom: 8, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center"
              }}>
                {editingActivitySettings.enabledTypes.length === 0 ? (
                  <span style={{ color: "#94a3b8", fontSize: 13, fontFamily: "'Nunito', sans-serif" }}>Click below to select activity types...</span>
                ) : (
                  editingActivitySettings.enabledTypes.map(type => {
                    const actType = ACTIVITY_TYPES.find(t => t.type === type);
                    if (!actType) return null;
                    return (
                      <span key={type} style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "4px 10px", borderRadius: 6, background: "#f3f4f6",
                        fontSize: 12, fontWeight: 600, color: "#374151", fontFamily: "'Nunito', sans-serif"
                      }}>
                        {actType.icon} {actType.label}
                        <button
                          onClick={() => toggleActivityType(type)}
                          style={{
                            background: "none", border: "none", padding: 0, marginLeft: 2,
                            cursor: "pointer", color: "#9ca3af", fontSize: 14, lineHeight: 1
                          }}>×</button>
                      </span>
                    );
                  })
                )}
              </div>

              {/* Dropdown list */}
              <div style={{ 
                maxHeight: 200, overflowY: "auto", borderRadius: 12, border: "1px solid #e5e7eb",
                background: "#fafafa"
              }}>
                {ACTIVITY_TYPES.map(actType => {
                  const isEnabled = editingActivitySettings.enabledTypes.includes(actType.type);
                  return (
                    <div
                      key={actType.type}
                      onClick={() => toggleActivityType(actType.type)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                        cursor: "pointer", borderBottom: "1px solid #f3f4f6",
                        background: isEnabled ? "#f0fdf4" : "transparent",
                        transition: "background 0.15s"
                      }}
                      onMouseEnter={e => { if (!isEnabled) e.currentTarget.style.background = "#f9fafb"; }}
                      onMouseLeave={e => { if (!isEnabled) e.currentTarget.style.background = "transparent"; }}>
                      <span style={{ fontSize: 16 }}>{actType.icon}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#374151", fontFamily: "'Nunito', sans-serif" }}>
                        {actType.label}
                      </span>
                      <div style={{
                        width: 18, height: 18, borderRadius: 4,
                        border: isEnabled ? "none" : "2px solid #d1d5db",
                        background: isEnabled ? "#22c55e" : "white",
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}>
                        {isEnabled && <span style={{ color: "white", fontSize: 11, fontWeight: 900 }}>✓</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, marginTop: 24 }}>
              <button
                onClick={() => setShowActivitySettingsModal(false)}
                style={{
                  flex: 1, padding: "12px", borderRadius: 10, border: "1px solid #e2e8f0", background: "white",
                  fontSize: 14, fontWeight: 700, color: "#4a6080", cursor: "pointer", fontFamily: "'Nunito', sans-serif"
                }}>
                Cancel
              </button>
              <button
                onClick={handleSaveActivitySettings}
                disabled={savingActivitySettings}
                style={{
                  flex: 1, padding: "12px", borderRadius: 10, border: "none",
                  background: savingActivitySettings ? "#94a3b8" : "#6366f1",
                  fontSize: 14, fontWeight: 700, color: "white", cursor: savingActivitySettings ? "not-allowed" : "pointer",
                  fontFamily: "'Nunito', sans-serif"
                }}>
                {savingActivitySettings ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default HomeMainView;
