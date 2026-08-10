import React, { useEffect, useState } from "react";
import moment from "moment";
import { useNavigate, useLocation } from "react-router-dom";
import { getEventsByUserId, deleteEvent } from "../../services/eventService";
import { getBusiness } from "../../services/businessService";
import { getCustomerSubscription, getSystemSubscriptions } from "../../services/paymentService";
import { getOrganizationBusinesses, getMyOrganizations } from "../../services/organizationService";
import { getEventPicture } from "../../utils/common";
import { toast } from "react-toastify";

const PLAN_LIMITS = { 1: 3, 2: 10, 3: 25, 4: Infinity };

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
.chip-purple{background:rgba(139,92,246,0.12);color:#7c3aed}
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
.ev-card-delete{width:30px;height:30px;border-radius:50%;background:rgba(232,68,90,0.1);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all var(--transition);flex-shrink:0;margin-left:8px}
.ev-card-delete:hover{background:rgba(232,68,90,0.25);transform:scale(1.1)}
.ev-card-delete svg{width:15px;height:15px;color:var(--red)}
.ev-card-check{position:absolute;bottom:12px;right:12px;width:24px;height:24px;border-radius:50%;border:2px solid rgba(0,119,204,0.4);background:rgba(255,255,255,0.9);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all var(--transition);z-index:2}
.ev-card-check.checked{background:var(--blue);border-color:var(--blue)}
.ev-card-check svg{width:14px;height:14px;color:#fff;opacity:0;transition:opacity 0.15s}
.ev-card-check.checked svg{opacity:1}
.ev-card{position:relative}
.ev-bulk-bar{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(10,37,64,0.95);backdrop-filter:blur(12px);border-radius:14px;padding:12px 24px;display:flex;align-items:center;gap:16px;box-shadow:0 8px 32px rgba(0,0,0,0.25);z-index:100;animation:ev-slide-up 0.25s ease}
@keyframes ev-slide-up{from{transform:translateX(-50%) translateY(20px);opacity:0}to{transform:translateX(-50%) translateY(0);opacity:1}}
.ev-bulk-bar span{color:#fff;font-size:14px;font-weight:600}
.ev-bulk-btn{border:none;border-radius:10px;padding:9px 18px;font-size:13px;font-weight:600;cursor:pointer;transition:all var(--transition);font-family:'Outfit',sans-serif}
.ev-bulk-btn-delete{background:#e8445a;color:#fff}
.ev-bulk-btn-delete:hover{background:#d63047}
.ev-bulk-btn-cancel{background:rgba(255,255,255,0.15);color:#fff}
.ev-bulk-btn-cancel:hover{background:rgba(255,255,255,0.25)}
.ev-select-btn{background:none;border:1.5px solid rgba(0,119,204,0.3);border-radius:10px;padding:9px 16px;font-size:13px;font-weight:600;color:var(--blue);cursor:pointer;transition:all var(--transition);font-family:'Outfit',sans-serif}
.ev-select-btn:hover{border-color:var(--blue);background:rgba(0,119,204,0.06)}
.ev-select-btn.active{background:var(--blue);color:#fff;border-color:var(--blue)}
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
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  console.log('[EventsView] 🔄 RENDER — pathname:', location.pathname, 'items.length:', items.length);

  useEffect(() => {
    console.log('[EventsView] 🚀 useEffect FIRED — location.key:', location.key);
    const load = async () => {
      console.log('[EventsView] 📡 load() starting...');
      const token = localStorage.getItem("idToken");
      const userId = parseJwt(token);
      if (!userId) { console.log('[EventsView] ❌ No userId from token'); setIsLoading(false); return; }

      const savedBiz = sessionStorage.getItem("selectedBusinessId");
      console.log('[EventsView] 👤 userId:', userId, '🏢 savedBiz:', savedBiz);

      // Fetch events
      let eventsData = [];
      try {
        // The X-Business-Id header (added by axios interceptor from sessionStorage)
        // tells the backend which business context to use. The backend resolves
        // the effective userId from this header, so we just need to call with any userId.
        console.log('[EventsView] 📡 Calling getEventsByUserId...');
        const res = await getEventsByUserId(userId);
        eventsData = (res.data || []);
        console.log('[EventsView] ✅ Events fetched:', eventsData.length, 'X-Business-Id header was:', sessionStorage.getItem("selectedBusinessId"));
      } catch (e) {
        console.error("[EventsView] ❌ Events error:", e.message, e.response?.status, e.response?.data);
      }
      console.log('[EventsView] 📊 Total eventsData:', eventsData.length);

      // Determine primary business for untagged event ownership
      let primaryBizId = null;
      try {
        const primaryRes = await getBusiness(userId);
        primaryBizId = primaryRes?.data?._id || null;
      } catch (e) { /* ignore */ }

      // Set items and selected business TOGETHER to avoid flash
      console.log('[EventsView] 💾 Setting items:', eventsData.length, 'events');
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

            // Store the owner userId for the selected business so other pages
            // (Dashboard, etc.) can fetch events without re-resolving.
            const selectedBizEntry = allBiz.find(b => b.linkedBusinessId === targetBizId);
            const ownerUserId = selectedBizEntry?.userId || userId;
            sessionStorage.setItem("selectedBusinessUserId", ownerUserId);

            // No need to re-fetch events here — the X-Business-Id header on the
            // initial fetch already told the backend which business to use.
            // The backend uses resolveEffectiveUserId to pick the right partition key.
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
        // Organization-tier businesses get unlimited event creation
        const orgsCheck = orgRes?.data?.organizations || orgRes?.data || [];
        if (orgsCheck.length > 0) level = 4;
        setCurrentLevel(level);
        setMaxAds(PLAN_LIMITS[level] || 3);
      });
    };
    load();
  }, [location.key]);

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

  const getUserId = () => {
    const token = localStorage.getItem("idToken");
    return parseJwt(token);
  };

  const handleDeleteSingle = async (ev, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${ev.name || 'this event'}"? This cannot be undone.`)) return;
    const userId = getUserId();
    if (!userId) return;
    try {
      setDeleting(true);
      await deleteEvent({ userId, _id: ev._id });
      setItems(prev => prev.filter(item => item._id !== ev._id));
      toast.success("Event deleted");
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete event");
    } finally {
      setDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    const count = selectedIds.size;
    if (count === 0) return;
    if (!window.confirm(`Delete ${count} event${count > 1 ? 's' : ''}? This cannot be undone.`)) return;
    const userId = getUserId();
    if (!userId) return;
    try {
      setDeleting(true);
      await Promise.all([...selectedIds].map(id => deleteEvent({ userId, _id: id })));
      setItems(prev => prev.filter(item => !selectedIds.has(item._id)));
      setSelectedIds(new Set());
      setSelectMode(false);
      toast.success(`${count} event${count > 1 ? 's' : ''} deleted`);
    } catch (err) {
      console.error("Bulk delete error:", err);
      toast.error("Some events could not be deleted");
    } finally {
      setDeleting(false);
    }
  };

  const toggleSelect = (id, e) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(ev => ev._id)));
    }
  };

  const filtered = items
    .filter(ev => {
      // Filter events by the selected business from the global context.
      if (selectedBusinessId) {
        if (ev.businessId === selectedBusinessId) {
          // Event explicitly tagged with this business — include
        } else if (ev.userId === selectedBusinessId) {
          // Event owned by this business (e.g. AI-published events) — include
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
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {filtered.length > 0 && (
                <button
                  className={`ev-select-btn${selectMode ? ' active' : ''}`}
                  onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
                >
                  {selectMode ? 'Cancel' : 'Select'}
                </button>
              )}
              <button className="ev-btn-primary" onClick={handleCreate}>+ Create Event</button>
            </div>
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
                <div key={ev._id} className="ev-card" onClick={() => selectMode ? toggleSelect(ev._id, { stopPropagation: () => {} }) : navigate(`/admin/my-events/${ev._id}`)} style={selectMode && selectedIds.has(ev._id) ? { borderColor: 'var(--blue)', borderWidth: 2 } : {}}>
                  {/* Select checkbox */}
                  {selectMode && (
                    <div className={`ev-card-check${selectedIds.has(ev._id) ? ' checked' : ''}`} onClick={(e) => toggleSelect(ev._id, e)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  )}
                  <div className="ev-card-top">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className={`ev-chip ${statusColor(status)}`} style={{ marginBottom: 8, display: "inline-flex" }}>{statusLabel(status)}</span>
                      {(ev.status === "inactive" || ev.status === "draft" || ev.isActive === false) && <span className="ev-chip chip-gold" style={{ marginBottom: 8, marginLeft: 6, display: "inline-flex" }}>Draft</span>}
                      {ev.visibility === "private" && <span className="ev-chip chip-purple" style={{ marginBottom: 8, marginLeft: 6, display: "inline-flex" }}>Private</span>}
                      {ev.createdByAi && <span className="ev-chip chip-teal" style={{ marginBottom: 8, marginLeft: 6, display: "inline-flex" }}>🤖 AI Published</span>}
                      {ev.testMode && <span className="ev-chip" style={{ marginBottom: 8, marginLeft: 6, display: "inline-flex", background: "rgba(245,158,11,0.12)", color: "#D97706" }}>Test</span>}
                      <div className="ev-card-name">{ev.name || "Untitled Event"}</div>
                      <div className="ev-card-sub">{[venue, cat].filter(Boolean).join(" \u00B7 ")}</div>
                    </div>
                    <img
                      className="ev-card-img"
                      src={ev.imageUrl && ev.createdByAi ? ev.imageUrl : getEventPicture(ev._id, 'thumb')}
                      alt=""
                      loading="lazy"
                      onError={e => {
                        // Fall back to external imageUrl for AI-published events
                        if (ev.imageUrl && e.target.src !== ev.imageUrl) {
                          e.target.src = ev.imageUrl;
                        } else {
                          e.target.style.display = "none";
                        }
                      }}
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {kpis.length > 0 && <span className="ev-card-link">{kpis.length} KPIs tracked →</span>}
                      {!selectMode && (
                        <button className="ev-card-delete" onClick={(e) => handleDeleteSingle(ev, e)} title="Delete event" disabled={deleting}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                      )}
                    </div>
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

          {/* Bulk action bar */}
          {selectMode && selectedIds.size > 0 && (
            <div className="ev-bulk-bar">
              <span>{selectedIds.size} selected</span>
              <button className="ev-bulk-btn ev-bulk-btn-cancel" onClick={toggleSelectAll}>
                {selectedIds.size === filtered.length ? 'Deselect All' : 'Select All'}
              </button>
              <button className="ev-bulk-btn ev-bulk-btn-delete" onClick={handleBulkDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : `Delete ${selectedIds.size}`}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default EventsView;
