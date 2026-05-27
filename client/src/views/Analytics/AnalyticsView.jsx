import React, { useState, useEffect } from "react";
import { getEventsByUserId } from "../../services/eventService";
import { getBusiness } from "../../services/businessService";
import { getBusinessAnalytics, getEventPTACount } from "../../services/analyticsService";
import { parseJwt } from "../../utils/common";
import moment from "moment";

const STATUS_CONFIG = {
  Past:     { color: "#94a3b8", bg: "rgba(148,163,184,0.12)", border: "rgba(148,163,184,0.3)", dot: "#94a3b8" },
  Active:   { color: "#34d399", bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.3)",  dot: "#34d399" },
  Upcoming: { color: "#f97316", bg: "rgba(249,115,22,0.12)",  border: "rgba(249,115,22,0.3)",  dot: "#f97316" },
};

const EVENT_COLORS = ["#a78bfa","#4dd9e0","#f97316","#f59e0b","#34d399","#60a5fa"];

const getEventStatus = (event) => {
  const now = new Date();
  const eventDate = new Date(event.date || event.startDate);
  const endDate = event.endDate ? new Date(event.endDate) : null;
  if (endDate && endDate < now) return "Past";
  if (eventDate > now) return "Upcoming";
  return "Active";
};

const S = `
@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.av-wrap{min-height:100vh;font-family:'Outfit','Nunito',sans-serif;background:linear-gradient(135deg,#e8f4fd 0%,#dbeeff 35%,#f0f8ff 65%,#e2eeff 100%);padding:28px 32px;overflow-x:hidden}
.av-inner{max-width:1200px;margin:0 auto}
.av-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
.av-title{font-size:26px;font-weight:900;color:#0d1b35}
.av-subtitle{font-size:13px;color:#2a4a6e;font-weight:600;margin-top:4px}
.av-stats{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.av-stat{flex:1 1 160px;background:rgba(255,255,255,0.55);backdrop-filter:blur(22px);border:1px solid rgba(255,255,255,0.6);border-radius:22px;padding:24px 26px;position:relative;overflow:hidden;transition:all .3s cubic-bezier(.23,1,.32,1);animation:slideUp .6s both}
.av-stat:hover{transform:translateY(-4px);background:rgba(255,255,255,0.75);box-shadow:0 16px 48px rgba(0,0,0,0.1)}
.av-stat-bar{position:absolute;top:0;left:0;right:0;height:3px;border-radius:22px 22px 0 0}
.av-stat-icon{width:44px;height:44px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:19px;margin-bottom:16px}
.av-stat-label{font-size:10px;font-weight:800;color:#4a6080;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:8px}
.av-stat-val{font-size:42px;font-weight:900;color:#0d1b35;line-height:1}
.av-stat-sub{font-size:12px;color:#6a7f9a;font-weight:600;margin-top:6px}
.av-insights{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:22px}
.av-insight{background:rgba(255,255,255,0.5);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.65);border-radius:20px;padding:20px 22px}
.av-insight-title{font-size:11px;font-weight:800;color:#4a6080;letter-spacing:0.14em;text-transform:uppercase;margin-bottom:14px}
.av-table-wrap{background:rgba(255,255,255,0.5);backdrop-filter:blur(22px);border:1px solid rgba(255,255,255,0.68);border-radius:24px;overflow:hidden}
.av-table-header{display:flex;justify-content:space-between;align-items:center;padding:20px 26px;border-bottom:1px solid rgba(13,27,53,0.07)}
.av-table-title{font-size:18px;font-weight:900;color:#0d1b35}
.av-table-sub{font-size:12px;color:#4a6080;font-weight:600;margin-top:2px}
.av-search{padding:9px 14px 9px 30px;border-radius:12px;border:1px solid rgba(13,27,53,0.14);background:rgba(255,255,255,0.7);font-size:13px;font-weight:600;color:#0d1b35;outline:none;width:170px;font-family:'Outfit',sans-serif}
.av-filters{display:flex;gap:6px;background:rgba(13,27,53,0.06);border-radius:12px;padding:4px}
.av-filter{padding:7px 14px;border-radius:9px;font-size:12px;font-weight:800;border:none;cursor:pointer;font-family:'Outfit',sans-serif;transition:all .2s}
.av-filter.on{background:#fff;color:#0d1b35;box-shadow:0 2px 8px rgba(0,0,0,0.1)}
.av-filter.off{background:transparent;color:#4a6080}
.av-table{width:100%;border-collapse:collapse}
.av-table th{padding:12px 26px;text-align:left;font-size:10px;font-weight:800;color:#4a6080;letter-spacing:0.16em;text-transform:uppercase;cursor:pointer;user-select:none;transition:color .2s;background:rgba(13,27,53,0.04)}
.av-table th:hover{color:#0d1b35}
.av-table th.sorted{color:#f97316}
.av-table td{padding:14px 26px;border-bottom:1px solid rgba(13,27,53,0.06)}
.av-table tr:hover{background:rgba(255,255,255,0.55)}
.av-table-footer{padding:14px 26px;border-top:1px solid rgba(13,27,53,0.06);display:flex;justify-content:space-between;align-items:center}
@media(max-width:768px){.av-wrap{padding:16px}.av-stats{display:grid;grid-template-columns:1fr 1fr}.av-insights{grid-template-columns:1fr}.av-table-header{flex-direction:column;gap:12px;align-items:stretch}.av-search{width:100%}}
`;

const AnalyticsView = () => {
  const [, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState({ totalFollowers: 0, totalEvents: 0, totalPTA: 0, activeEvents: 0 });
  const [events, setEvents] = useState([]);
  const [businessInfo, setBusinessInfo] = useState(null);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  const idToken = localStorage.getItem("idToken");
  const userId = idToken ? parseJwt(idToken) : null;

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    const load = async () => {
      try {
        const savedBizId = sessionStorage.getItem("selectedBusinessId");

        // Fetch events FIRST (fast path — show page immediately)
        const eventsRes = await getEventsByUserId(userId);
        const allEvents = eventsRes.data || [];

        // Determine primary business ID for untagged event ownership
        let primaryBizId = null;
        try {
          const primaryRes = await getBusiness(userId);
          primaryBizId = primaryRes?.data?._id || null;
        } catch (e) { /* ignore */ }

        // Filter events by selected business
        const filteredEvents = savedBizId
          ? allEvents.filter(e => {
              if (e.businessId === savedBizId) return true;
              if (!e.businessId && savedBizId === primaryBizId) return true;
              return false;
            })
          : allEvents;

        const eventsData = filteredEvents.map((e, i) => ({ ...e, ptaCount: 0, color: EVENT_COLORS[i % EVENT_COLORS.length] }));
        setEvents(eventsData);

        // Calculate initial analytics without PTA
        const now = new Date();
        const activeCount = eventsData.filter(e => new Date(e.date || e.startDate) >= now).length;
        setAnalytics({ totalFollowers: 0, totalEvents: eventsData.length, totalPTA: 0, activeEvents: activeCount });
        setLoading(false); // Show page now

        // Load business info + PTA in background (non-blocking)
        getBusiness(userId, savedBizId || undefined).then(bizRes => {
          if (bizRes?.data) {
            setBusinessInfo(bizRes.data);
            setAnalytics(prev => ({ ...prev, totalFollowers: bizRes.data.followersCount || 0 }));
          }
        }).catch(() => {});

        // Load PTA counts in background
        getBusinessAnalytics(userId).then(analyticsRes => {
          if (analyticsRes?.data?.totalPTA) {
            setAnalytics(prev => ({ ...prev, totalPTA: analyticsRes.data.totalPTA }));
          }
        }).catch(() => {});

        // Load individual PTA counts in background (batch, non-blocking)
        Promise.all(
          eventsData.map(async (event) => {
            try {
              const ptaRes = await getEventPTACount(event._id);
              return { id: event._id, ptaCount: ptaRes.data?.count || 0 };
            } catch { return { id: event._id, ptaCount: 0 }; }
          })
        ).then(ptaResults => {
          setEvents(prev => prev.map(ev => {
            const pta = ptaResults.find(p => p.id === ev._id);
            return pta ? { ...ev, ptaCount: pta.ptaCount } : ev;
          }));
          const totalPTA = ptaResults.reduce((s, p) => s + p.ptaCount, 0);
          setAnalytics(prev => ({ ...prev, totalPTA: prev.totalPTA || totalPTA }));
        });

      } catch (err) { console.error("Analytics error:", err); setLoading(false); }
    };
    load();
  }, [userId]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const filtered = events
    .filter(e => {
      const status = getEventStatus(e);
      if (filter !== "All" && status !== filter) return false;
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      let va, vb;
      if (sortKey === "date") { va = new Date(a.date || a.startDate); vb = new Date(b.date || b.startDate); }
      else if (sortKey === "pta") { va = a.ptaCount || 0; vb = b.ptaCount || 0; }
      else if (sortKey === "name") { va = a.name; vb = b.name; }
      else { va = getEventStatus(a); vb = getEventStatus(b); }
      return sortDir === "asc" ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
    });

  const ptaByStatus = [
    { label: "Active", val: events.filter(e => getEventStatus(e) === "Active").reduce((s, e) => s + (e.ptaCount || 0), 0), color: "#34d399" },
    { label: "Past", val: events.filter(e => getEventStatus(e) === "Past").reduce((s, e) => s + (e.ptaCount || 0), 0), color: "#4dd9e0" },
    { label: "Upcoming", val: events.filter(e => getEventStatus(e) === "Upcoming").reduce((s, e) => s + (e.ptaCount || 0), 0), color: "#f97316" },
  ];
  const maxPta = Math.max(...ptaByStatus.map(p => p.val), 1);

  // Render the shell immediately — the Router's Suspense fallback already
  // covered chunk load, and a second full-screen spinner here just stacks
  // a loader on top of a loader.
  // (Was: if (loading) return <MTBLoading />.)

  return (
    <>
      <style>{S}</style>
      <div className="av-wrap">
        <div className="av-inner">
          {/* Header */}
          <div className="av-header">
            <div>
              <div className="av-title">Business <span style={{ color: "#f97316" }}>Analytics</span></div>
              <div className="av-subtitle">{businessInfo?.name || "Your Business"} — Track your performance and engagement</div>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="av-stats">
            {[
              { icon: "👥", label: "Total Followers", val: analytics.totalFollowers, sub: "Users following your business", color: "#a78bfa", gradient: "linear-gradient(135deg,#a78bfa,#7c3aed)" },
              { icon: "📅", label: "Total Events", val: analytics.totalEvents, sub: "All events created", color: "#4dd9e0", gradient: "linear-gradient(135deg,#4dd9e0,#0891b2)" },
              { icon: "✓", label: "Total PTA", val: analytics.totalPTA, sub: "Planning to attend", color: "#34d399", gradient: "linear-gradient(135deg,#34d399,#059669)" },
              { icon: "🔥", label: "Active Events", val: analytics.activeEvents, sub: "Upcoming events", color: "#f97316", gradient: "linear-gradient(135deg,#f97316,#dc2626)" },
            ].map((s, i) => (
              <div key={i} className="av-stat" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="av-stat-bar" style={{ background: s.gradient }} />
                <div className="av-stat-icon" style={{ background: s.gradient, boxShadow: `0 6px 18px ${s.color}40` }}>{s.icon}</div>
                <div className="av-stat-label">{s.label}</div>
                <div className="av-stat-val">{s.val}</div>
                <div className="av-stat-sub">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Mini Insights */}
          <div className="av-insights">
            {/* PTA by Status */}
            <div className="av-insight">
              <div className="av-insight-title">PTA by Status</div>
              {ptaByStatus.map((b, i) => (
                <div key={i} style={{ marginBottom: i < 2 ? 12 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0d1b35" }}>{b.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: b.color }}>{b.val}</span>
                  </div>
                  <div style={{ height: 7, background: "rgba(13,27,53,0.07)", borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 6, background: b.color, width: b.val === 0 ? "4%" : `${(b.val / maxPta) * 100}%`, transition: "width 1s" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Event Breakdown */}
            <div className="av-insight">
              <div className="av-insight-title">Event Breakdown</div>
              {[
                { label: "Past", count: events.filter(e => getEventStatus(e) === "Past").length, color: "#94a3b8" },
                { label: "Active", count: events.filter(e => getEventStatus(e) === "Active").length, color: "#34d399" },
                { label: "Upcoming", count: events.filter(e => getEventStatus(e) === "Upcoming").length, color: "#f97316" },
              ].map((row, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 9, background: `${row.color}18`, border: `1.5px solid ${row.color}40`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: row.color }}>{row.count}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#0d1b35" }}>{row.label}</div>
                    <div style={{ height: 4, width: `${(row.count / Math.max(events.length, 1)) * 120}px`, background: row.color, borderRadius: 3, opacity: 0.6 }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Engagement */}
            <div className="av-insight">
              <div className="av-insight-title">Engagement</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 42, fontWeight: 900, color: "#0d1b35" }}>{events.length > 0 ? Math.round((analytics.activeEvents / events.length) * 100) : 0}</span>
                <span style={{ fontSize: 16, fontWeight: 800, color: "#34d399" }}>%</span>
              </div>
              <div style={{ fontSize: 12, color: "#4a6080", fontWeight: 600, marginBottom: 14 }}>Active event rate</div>
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(13,27,53,0.08)" strokeWidth="8"/>
                <circle cx="36" cy="36" r="28" fill="none" stroke="#34d399" strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${(events.length > 0 ? analytics.activeEvents / events.length : 0) * 175.9} ${175.9}`}
                  strokeDashoffset="44" transform="rotate(-90 36 36)" style={{ filter: "drop-shadow(0 0 6px #34d39966)" }}/>
              </svg>
            </div>
          </div>

          {/* Events Table */}
          <div className="av-table-wrap">
            <div className="av-table-header">
              <div>
                <div className="av-table-title">Events Breakdown</div>
                <div className="av-table-sub">{filtered.length} of {events.length} events</div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#4a6080" }}>⌕</span>
                  <input className="av-search" placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <div className="av-filters">
                  {["All", "Active", "Past", "Upcoming"].map(f => (
                    <button key={f} className={`av-filter ${filter === f ? "on" : "off"}`} onClick={() => setFilter(f)}>{f}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="av-table">
                <thead>
                  <tr>
                    {[{ key: "name", label: "EVENT NAME" }, { key: "date", label: "DATE" }, { key: "status", label: "STATUS" }, { key: "pta", label: "PTA COUNT" }].map(col => (
                      <th key={col.key} className={sortKey === col.key ? "sorted" : ""} onClick={() => handleSort(col.key)} style={{ textAlign: col.key === "pta" ? "center" : "left" }}>
                        {col.label} <span style={{ fontSize: 10, opacity: sortKey === col.key ? 1 : 0.3 }}>{sortKey === col.key ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(ev => {
                    const status = getEventStatus(ev);
                    const sc = STATUS_CONFIG[status];
                    return (
                      <tr key={ev._id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ width: 6, height: 6, borderRadius: "50%", background: ev.color, boxShadow: `0 0 6px ${ev.color}88` }} />
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#0d1b35" }}>{ev.name}</span>
                          </div>
                        </td>
                        <td><span style={{ fontSize: 13, fontWeight: 700, color: "#f97316" }}>{moment(ev.date || ev.startDate).format("MMM D, YYYY")}</span></td>
                        <td>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 20, background: sc.bg, border: `1px solid ${sc.border}`, fontSize: 11, fontWeight: 800, color: sc.color }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.dot }} />{status}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: "50%", background: (ev.ptaCount || 0) > 0 ? "linear-gradient(135deg,#4dd9e0,#1560a8)" : "rgba(13,27,53,0.07)", color: (ev.ptaCount || 0) > 0 ? "#fff" : "#4a6080", fontSize: 13, fontWeight: 900 }}>
                            {ev.ptaCount || 0}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 48, textAlign: "center", color: "#4a6080", fontSize: 14, fontWeight: 600 }}>No events match your search</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="av-table-footer">
              <span style={{ fontSize: 12, color: "#4a6080", fontWeight: 600 }}>Showing {filtered.length} events</span>
              <div style={{ display: "flex", gap: 6 }}>
                {["Past", "Active", "Upcoming"].map(s => {
                  const sc = STATUS_CONFIG[s];
                  const n = events.filter(e => getEventStatus(e) === s).length;
                  return <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 12, background: sc.bg, fontSize: 11, fontWeight: 700, color: sc.color }}><span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.dot }} />{n} {s}</span>;
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default AnalyticsView;
