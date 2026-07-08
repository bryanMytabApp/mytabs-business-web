import React, { useEffect, useState } from "react";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { getEventsByUserId } from "../../services/eventService";
import { getBusiness } from "../../services/businessService";
import { getCustomerSubscription, getSystemSubscriptions } from "../../services/paymentService";
import { getOrganizationBusinesses, getMyOrganizations } from "../../services/organizationService";
import { getEventPicture } from "../../utils/common";
import { toast } from "react-toastify";

const PLAN_LIMITS = { 1: 3, 2: 10, 3: 25 };

const parseJwt = (token) => {
  if (!token || typeof token !== "string" || token.split(".").length !== 3) return null;
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(atob(base64).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
    return JSON.parse(jsonPayload)["custom:user_id"];
  } catch { return null; }
};

const toMoment = (val) => {
  if (!val) return null;
  // If it's already a Date or a valid ISO/number, moment handles it.
  // If it's a JS Date toString() like "Thu May 28 2026 08:09:00 GMT-0500",
  // wrap it in new Date() to avoid moment's deprecation fallback warning.
  if (val instanceof Date) return moment(val);
  if (typeof val === "number") return moment(val);
  if (typeof val === "string") {
    // ISO 8601 / RFC2822 strings parse cleanly; everything else goes through Date.
    const isoLike = /^\d{4}-\d{2}-\d{2}/.test(val);
    return isoLike ? moment(val) : moment(new Date(val));
  }
  return moment(val);
};

const getEventStatus = (event) => {
  const now = moment();
  const start = toMoment(event.startDate);
  const end = toMoment(event.endDate);
  // An event is completed if its end time has fully passed.
  if (end && end.isValid() && end.isAfter(start)) {
    if (end.isBefore(now)) return "completed";
  } else if (start && start.isValid()) {
    // No valid end or end <= start: use start + 4 hours as implicit end
    // (most events don't last more than 4 hours without an explicit end time)
    if (moment(start).add(4, 'hours').isBefore(now)) return "completed";
  }
  if (start && start.isAfter(now)) return "planning";
  return "active";
};

const pct = (cur, tar) => Math.min(100, Math.round((cur / (tar || 1)) * 100));
const kpiHealth = (p, alert = 70) => p >= 90 ? "green" : p >= alert ? "gold" : "red";
const healthColor = (h) => ({ green: "var(--green)", gold: "var(--gold)", red: "var(--red)" }[h] || "var(--blue)");
const statusColor = (s) => ({ active: "chip-blue", planning: "chip-teal", completed: "chip-green", cancelled: "chip-red", draft: "chip-gold" }[s] || "chip-blue");
const statusLabel = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "Active";
const daysUntil = (d) => {
  if (!d) return null;
  const eventDay = moment(new Date(d)).startOf('day');
  const today = moment().startOf('day');
  return eventDay.diff(today, 'days');
};

const S = `
:root{--blue:#0077cc;--blue-light:#3399ee;--blue-pale:#cce4f7;--navy:#0a2540;--teal:#00b4d8;--gold:#f4a723;--green:#1ab76b;--red:#e8445a;--text:#0a2540;--text-muted:#5a738a;--text-light:#8fa8be;--glass-bg:rgba(255,255,255,0.62);--glass-border:rgba(255,255,255,0.85);--glass-shadow:0 8px 32px rgba(0,120,200,0.10),0 1.5px 8px rgba(0,80,160,0.07);--radius:18px;--radius-sm:10px;--transition:0.22s cubic-bezier(.4,0,.2,1)}
.ev-wrap{min-height:100vh;background:linear-gradient(135deg,#e8f4fd 0%,#dbeeff 35%,#f0f8ff 65%,#e2eeff 100%);padding:32px;font-family:'Outfit',sans-serif;color:var(--text);position:relative}
.ev-wrap::before{content:'';position:fixed;inset:0;background:radial-gradient(ellipse 80% 60% at 20% 20%,rgba(0,180,216,0.13) 0%,transparent 60%),radial-gradient(ellipse 60% 80% at 80% 80%,rgba(0,119,204,0.10) 0%,transparent 60%);pointer-events:none;z-index:0}
.ev-inner{max-width:1200px;margin:0 auto;position:relative;z-index:1}
.ev-header{display:flex;align-items:flex-end;justify-content:space-between;margin-bottom:28px}
.ev-title{font-size:26px;font-weight:900;color:#0d1b35;letter-spacing:-0.3px;line-height:1.2}
.ev-subtitle{font-size:14px;color:var(--text-muted);margin-top:6px}
.ev-btn-primary{background:linear-gradient(135deg,#F09925 0%,#f97316 100%);color:#fff;border:none;border-radius:12px;padding:11px 22px;font-size:14px;font-weight:600;cursor:pointer;transition:all var(--transition);display:inline-flex;align-items:center;gap:8px;font-family:'Outfit',sans-serif;box-shadow:0 4px 14px rgba(249,115,22,0.3)}
.ev-btn-primary:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(249,115,22,0.38);filter:brightness(1.05)}
.ev-filter-bar{background:rgba(255,255,255,0.75);backdrop-filter:blur(18px) saturate(1.4);border:1.5px solid rgba(200,220,240,0.6);box-shadow:0 4px 20px rgba(0,100,180,0.06);border-radius:14px;padding:14px 18px;margin-bottom:24px;display:flex;gap:12px;align-items:center}
.ev-search{flex:0 0 280px;padding:10px 14px;background:rgba(255,255,255,0.75);backdrop-filter:blur(8px);border:1.5px solid rgba(0,100,180,0.15);border-radius:11px;font-size:14px;color:var(--text);font-family:'Outfit',sans-serif;outline:none;transition:all var(--transition)}
.ev-search:focus{border-color:var(--blue);background:rgba(255,255,255,0.92);box-shadow:0 0 0 3px rgba(0,119,204,0.12)}
.ev-search::placeholder{color:var(--text-light)}
.ev-tabs{display:flex;gap:4px;background:rgba(0,80,160,0.06);padding:4px;border-radius:12px;flex:1;max-width:480px;overflow-x:auto;-webkit-overflow-scrolling:touch}
.ev-tab{flex-shrink:0;padding:8px 14px;border:none;background:none;border-radius:9px;font-size:13px;font-weight:500;color:var(--text-muted);cursor:pointer;transition:all var(--transition);font-family:'Outfit',sans-serif;white-space:nowrap}
.ev-tab.on{background:var(--blue);color:#fff;font-weight:700;box-shadow:0 2px 8px rgba(0,119,204,0.25)}
.ev-chip{display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:99px;font-size:11.5px;font-weight:600}
.chip-blue{background:rgba(0,119,204,0.12);color:var(--blue)}
.chip-green{background:rgba(26,183,107,0.12);color:var(--green)}
.chip-red{background:rgba(232,68,90,0.12);color:var(--red)}
.chip-teal{background:rgba(0,180,216,0.12);color:#0099bb}
.chip-gold{background:rgba(244,167,35,0.14);color:#c47e00}
.ev-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:18px}
.ev-card{background:var(--glass-bg);backdrop-filter:blur(18px) saturate(1.4);border:1.5px solid var(--glass-border);box-shadow:var(--glass-shadow);border-radius:var(--radius);padding:22px;cursor:pointer;transition:all var(--transition);display:flex;flex-direction:column}
.ev-card:hover{transform:translateY(-3px);box-shadow:0 12px 40px rgba(0,100,180,0.14)}
.ev-card-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}
.ev-card-img{width:90px;height:90px;border-radius:10px;object-fit:cover;flex-shrink:0;background:rgba(0,100,180,0.06)}
.ev-card-name{font-size:17px;font-weight:700;color:var(--navy);line-height:1.2;margin-top:8px}
.ev-card-sub{font-size:12px;color:var(--text-muted);margin-top:4px}
.ev-card-avg{text-align:right;flex-shrink:0}
.ev-card-avg-num{font-size:22px;font-weight:700;line-height:1}
.ev-card-avg-lbl{font-size:10px;color:var(--text-muted)}
.ev-kpis{flex:1;margin-bottom:14px}
.ev-kpi-row{margin-bottom:7px}
.ev-kpi-row-top{display:flex;justify-content:space-between;margin-bottom:3px}
.ev-kpi-name{font-size:11px;color:var(--text-muted)}
.ev-kpi-pct{font-size:11px;font-weight:700}
.ev-kpi-bar{background:rgba(0,100,180,0.07);border-radius:99px;height:5px;overflow:hidden}
.ev-kpi-fill{height:100%;border-radius:99px;transition:width 0.8s cubic-bezier(.4,0,.2,1)}
.ev-card-bottom{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:10px;border-top:1px solid rgba(0,100,180,0.07)}
.ev-card-date{font-size:12px;color:var(--text-muted)}
.ev-card-link{font-size:11.5px;color:var(--blue);font-weight:600}
.ev-card-more{font-size:11px;color:var(--text-muted);margin-top:4px}
.ev-create{background:rgba(255,255,255,0.35);backdrop-filter:blur(12px);border:2px dashed rgba(0,119,204,0.25);border-radius:var(--radius);padding:22px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:220px;gap:10px;transition:all var(--transition)}
.ev-create:hover{border-color:var(--blue);background:rgba(255,255,255,0.55)}
.ev-create-icon{width:48px;height:48px;border-radius:50%;background:rgba(0,119,204,0.1);display:flex;align-items:center;justify-content:center;font-size:24px;color:var(--blue)}
.ev-create-title{font-size:14px;font-weight:600;color:var(--blue)}
.ev-create-sub{font-size:12px;color:var(--text-muted);text-align:center}
@media(max-width:768px){.ev-wrap{padding:16px}.ev-grid{grid-template-columns:1fr}.ev-filter-bar{flex-direction:column;align-items:stretch;gap:10px;padding:12px}.ev-search{flex:none;width:100%}.ev-tabs{max-width:none;overflow-x:auto;flex:none}.ev-tab{padding:8px 12px;font-size:12px}.ev-chip{align-self:flex-start}.ev-header{flex-direction:column;align-items:flex-start;gap:12px}.ev-title{font-size:22px}}
`;

const EventsView = () => {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [, setIsLoading] = useState(true);
  const [, setCurrentLevel] = useState(1);
  const [maxAds, setMaxAds] = useState(Infinity);  // Start at Infinity so the limit warning never fires before subscription loads
  const [, setAllBusinesses] = useState([]);
  const [selectedBusinessId, setSelectedBusinessId] = useState(sessionStorage.getItem("selectedBusinessId") || null);
  const [primaryBizId, setPrimaryBizId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem("idToken");
      const userId = parseJwt(token);
      if (!userId) { setIsLoading(false); return; }

      const savedBiz = sessionStorage.getItem("selectedBusinessId");

      // Fetch events
      let eventsData = [];
      try {
        const res = await getEventsByUserId(userId);
        eventsData = (res.data || []).slice(0, 25);
      } catch (e) {
        console.error("Events error:", e);
      }

      // Determine primary business for untagged event ownership
      let primaryBizId = null;
      try {
        const primaryRes = await getBusiness(userId);
        primaryBizId = primaryRes?.data?._id || null;
      } catch (e) { /* ignore */ }

      // Set items and selected business TOGETHER to avoid flash
      setItems(eventsData);
      if (savedBiz) setSelectedBusinessId(savedBiz);
      if (primaryBizId) setPrimaryBizId(primaryBizId);
      setIsLoading(false);

      // Load business list + subscription in background (non-blocking).
      Promise.all([
        getMyOrganizations().catch(() => null),
        getSystemSubscriptions().catch(() => null),
        getCustomerSubscription({ userId }).catch(() => null),
      ]).then(async ([orgRes, sysRes, custRes]) => {
        try {
          const orgs = orgRes?.data?.organizations || orgRes?.data || [];
          if (orgs.length > 0) {
            const orgId = orgs[0].organizationId || orgs[0].id || orgs[0]._id;
            const orgName = orgs[0].name || 'Organization';
            const orgRole = orgs[0].role || 'member';
            const bizRes = await getOrganizationBusinesses(orgId).catch(() => null);
            const businesses = bizRes?.data?.businesses || bizRes?.data || [];
            const allBiz = [];
            // For org owner, use the actual business _id (not userId)
            if (orgRole === 'owner') {
              let ownerBizId = userId;
              try {
                const ownerBizRes = await getBusiness(userId);
                const ownerBiz = ownerBizRes?.data || ownerBizRes;
                if (ownerBiz?._id) ownerBizId = ownerBiz._id;
              } catch (e) { /* fallback to userId */ }
              allBiz.push({ linkedBusinessId: ownerBizId, userId: userId, name: orgName, isPayer: true });
            }
            allBiz.push(...businesses.filter(b => b.linkedBusinessId !== userId));
            setAllBusinesses(allBiz);

            // Determine which business to select:
            // 1. If savedBiz exists AND is still in the list → use it.
            // 2. Otherwise → first business in the list.
            let targetBizId;
            if (savedBiz && allBiz.some(b => b.linkedBusinessId === savedBiz)) {
              targetBizId = savedBiz;
            } else {
              targetBizId = allBiz.length > 0 ? allBiz[0].linkedBusinessId : userId;
              sessionStorage.setItem("selectedBusinessId", targetBizId);
            }
            setSelectedBusinessId(targetBizId);

            // Org owners can switch between linked businesses. When the
            // pinned business is owned by someone else, refetch using that
            // owner's userId so the events for THAT business appear. For
            // team members (and the org owner viewing their own business)
            // the fast-path fetch above is already correct — skip the
            // refetch to avoid clobbering the events with an empty list
            // when the resolution returns nothing.
            const targetBiz = allBiz.find(b => b.linkedBusinessId === targetBizId);
            const targetOwnerUserId = targetBiz?.userId;
            const isDifferentOwner = targetOwnerUserId && targetOwnerUserId !== userId;
            if (isDifferentOwner) {
              try {
                const evRes = await getEventsByUserId(targetOwnerUserId);
                setItems(evRes.data || []);
              } catch (e) {
                console.error("Events fetch (owner) error:", e);
                // Don't blow away the items already on screen.
              }
            }
          }
          // No organizations: nothing to do — fast-path fetch already loaded the user's events.
        } catch (e) {
          console.error("Org fetch error:", e);
        }

        // Subscription level
        let level = 1;
        try {
          if (custRes?.data?.hasSubscription && custRes?.data?.priceId && sysRes?.data) {
            const sub = sysRes.data.find(s => s.priceId === custRes.data.priceId);
            if (sub) level = sub.level;
          }
        } catch (e) {}
        setCurrentLevel(level);
        setMaxAds(PLAN_LIMITS[level] || 3);
      });
    };
    load();
  }, []);

  const handleCreate = () => {
    if (items.length >= maxAds) {
      toast.warn(`You can only have ${maxAds} ads on your current plan. Upgrade to create more!`);
      return;
    }
    // Ensure the currently selected business is persisted before navigating
    // so EventCreateNew picks up the correct businessId.
    if (selectedBusinessId) {
      sessionStorage.setItem("selectedBusinessId", selectedBusinessId);
    }
    navigate("/admin/my-events/create");
  };

  const filtered = items
    .filter(ev => {
      // Filter events by the selected business from the global context.
      if (selectedBusinessId) {
        if (ev.businessId === selectedBusinessId) {
          // Event explicitly tagged with this business — include
        } else if (!ev.businessId && selectedBusinessId === primaryBizId) {
          // Untagged event + primary business selected — include
        } else {
          return false;
        }
      }

      const status = getEventStatus(ev);
      const isDraft = ev.status === "inactive" || ev.status === "draft" || ev.isActive === false;
      if (filter === "draft" && !isDraft) return false;
      if (filter !== "all" && filter !== "draft" && status !== filter) return false;
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        return (ev.name || "").toLowerCase().includes(q) || (ev.description || "").toLowerCase().includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      // Sort by startDate - upcoming events first, then past events
      const dateA = a.startDate ? new Date(a.startDate) : new Date(0);
      const dateB = b.startDate ? new Date(b.startDate) : new Date(0);
      const now = new Date();
      const aIsFuture = dateA >= now;
      const bIsFuture = dateB >= now;
      
      // Future events come before past events
      if (aIsFuture && !bIsFuture) return -1;
      if (!aIsFuture && bIsFuture) return 1;
      
      // Within same category, sort by date (ascending for future, descending for past)
      if (aIsFuture) {
        return dateA - dateB; // Soonest upcoming first
      } else {
        return dateB - dateA; // Most recent past first
      }
    });

  // Suspense fallback in Router.jsx already covers chunk load. Render the
  // shell immediately so the user doesn't see two spinners in a row. Empty
  // events while data arrives just renders the create card and an empty
  // grid — fine for the second or so it takes the API to respond.

  return (
    <>
      <style>{S}</style>
      <div className="ev-wrap">
        <div className="ev-inner">
          {/* Header */}
          <div className="ev-header">
            <div>
              <div className="ev-title">Event <span style={{color:'#f97316'}}>Management</span></div>
              <div style={{ fontSize: 14, color: '#2a4a6e', fontWeight: 600, marginTop: 4 }}>Create, manage, and track your events and advertisements</div>
            </div>
            <button className="ev-btn-primary" onClick={handleCreate}>+ Create Event</button>
          </div>

          {/* Filter bar */}
          <div className="ev-filter-bar">
            <input className="ev-search" placeholder="Search events..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            <div className="ev-tabs">
              {["all", "draft", "planning", "completed"].map(t => (
                <button key={t} className={`ev-tab${filter === t ? " on" : ""}`} onClick={() => setFilter(t)}>
                  {t === "all" ? "All" : statusLabel(t)}
                </button>
              ))}
            </div>
            <span className="ev-chip chip-blue">{filtered.length} event{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {/* Card grid */}
          <div className="ev-grid">
            {filtered.map(ev => {
              const status = getEventStatus(ev);
              const kpis = ev.kpis || [];
              const d = daysUntil(ev.startDate);
              const venue = ev.venue || "";
              const cat = ev.category || ev.cat || "";

              return (
                <div key={ev._id} className="ev-card" onClick={() => navigate(`/admin/my-events/${ev._id}`)}>
                  <div className="ev-card-top">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className={`ev-chip ${statusColor(status)}`} style={{ marginBottom: 8, display: "inline-flex" }}>{statusLabel(status)}</span>
                      {(ev.status === "inactive" || ev.status === "draft" || ev.isActive === false) && <span className="ev-chip chip-gold" style={{ marginBottom: 8, marginLeft: 6, display: "inline-flex" }}>Draft</span>}
                      <div className="ev-card-name">{ev.name || "Untitled Event"}</div>
                      <div className="ev-card-sub">{[venue, cat].filter(Boolean).join(" \u00B7 ")}</div>
                    </div>
                    <img
                      className="ev-card-img"
                      src={getEventPicture(ev._id, 'thumb')}
                      alt=""
                      loading="lazy"
                      onError={e => { e.target.style.display = "none"; }}
                    />
                  </div>

                  <div className="ev-kpis">
                    {kpis.slice(0, 3).map((k, i) => {
                      const cur = parseFloat(k.cur || k.current) || 0;
                      const target = parseFloat(k.target) || 1;
                      const p = pct(cur, target);
                      const h = kpiHealth(p, parseFloat(k.alert) || 70);
                      return (
                        <div key={i} className="ev-kpi-row">
                          <div className="ev-kpi-row-top">
                            <span className="ev-kpi-name">{k.label}</span>
                            <span className="ev-kpi-pct" style={{ color: healthColor(h) }}>{p}%</span>
                          </div>
                          <div className="ev-kpi-bar"><div className="ev-kpi-fill" style={{ width: `${p}%`, background: healthColor(h) }} /></div>
                        </div>
                      );
                    })}
                    {kpis.length > 3 && <div className="ev-card-more">+{kpis.length - 3} more KPIs</div>}
                  </div>

                  <div className="ev-card-bottom">
                    <span className="ev-card-date">
                      {ev.startDate ? (toMoment(ev.startDate)?.format("MMM D, YYYY") || "No date") : "No date"}
                      {d === 0 ? " \u00B7 Today" : d === 1 ? " \u00B7 Tomorrow" : d !== null && d > 1 ? ` \u00B7 ${d}d away` : ""}
                      {ev.startDate ? ` @ ${toMoment(ev.startDate)?.format("h:mm A") || ""}` : ""}
                    </span>
                    {kpis.length > 0 && <span className="ev-card-link">{kpis.length} KPIs tracked →</span>}
                  </div>
                </div>
              );
            })}

            {/* Create New Event card */}
            <div className="ev-create" onClick={handleCreate}>
              <div className="ev-create-icon">+</div>
              <div className="ev-create-title">Create New Event</div>
              <div className="ev-create-sub">Add KPIs, set targets, and track progress</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EventsView;
