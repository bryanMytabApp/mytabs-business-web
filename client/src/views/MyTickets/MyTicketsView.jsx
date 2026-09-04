import React, { useState, useEffect } from 'react';
import { getEventsByUserId } from '../../services/eventService';
import { getTicketsByEvent } from '../../services/ticketManagementService';
import { getCurrentUserId, buildAuthenticatedReturnUrl } from '../../utils/authUtils';
import { getEventPayouts } from '../../services/paymentService';
import CustomerServiceView from './CustomerServiceView';
import moment from 'moment';

// Map a raw ticket row (as stored in the tickets table) to the `purchase`
// shape CustomerServiceView expects. The purchase/checkout pipeline writes
// buyerName/buyerEmail, while the direct-payment path uses customerName/
// customerEmail, so read both defensively.
export const ticketToPurchase = (t = {}) => {
  const name = t.buyerName || t.customerName || 'Guest';
  const email = t.buyerEmail || t.customerEmail || '';
  const price = parseFloat(t.price) || 0;
  const purchasedAt = t.purchasedAt || t.createdAt || null;
  return {
    customerName: name,
    customerEmail: email,
    confirmationNumber: t.ticketId || t._id || '',
    totalAmount: price.toFixed(2),
    paymentMethod: t.paymentMethod || 'Card',
    purchaseDate: purchasedAt ? moment(purchasedAt).format('MMM D, YYYY') : '—',
    timeAgo: purchasedAt ? moment(purchasedAt).fromNow() : '',
    ticketDetails: `1x ${t.ticketType || 'General Admission'}`,
    status: t.status || 'active',
    raw: t,
  };
};

// Cents (integer minor units) → "$1,234.56".
const fmtCents = (cents, currency = 'usd') => {
  const n = Number.isFinite(cents) ? cents : 0;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'usd').toUpperCase() }).format(n / 100);
  } catch {
    return `$${(n / 100).toFixed(2)}`;
  }
};

const S = `
@keyframes slideUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
.tv-wrap{min-height:100vh;font-family:'Outfit','Nunito',sans-serif;background:linear-gradient(135deg,#e8f4fd 0%,#dbeeff 35%,#f0f8ff 65%,#e2eeff 100%);padding:28px 32px;overflow-x:hidden}
.tv-inner{max-width:1200px;margin:0 auto}
.tv-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px}
.tv-title{font-size:26px;font-weight:900;color:#0d1b35;display:flex;align-items:center;gap:12px}
.tv-subtitle{font-size:13px;color:#2a4a6e;font-weight:600;margin-top:4px}
.tv-stats{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:22px}
.tv-stat{flex:1 1 140px;background:rgba(255,255,255,0.52);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.6);border-radius:22px;padding:24px 26px;position:relative;overflow:hidden;transition:all .3s cubic-bezier(.23,1,.32,1);animation:slideUp .6s both}
.tv-stat:hover{transform:translateY(-4px);background:rgba(255,255,255,0.75);box-shadow:0 16px 48px rgba(0,0,0,0.1)}
.tv-stat-bar{position:absolute;top:0;left:0;right:0;height:3px;border-radius:22px 22px 0 0}
.tv-stat-icon{width:44px;height:44px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:20px;margin-bottom:16px}
.tv-stat-label{font-size:10px;font-weight:800;color:#4a6080;letter-spacing:0.16em;text-transform:uppercase;margin-bottom:8px}
.tv-stat-val{font-size:36px;font-weight:900;color:#0d1b35;line-height:1}
.tv-stat-sub{font-size:12px;color:#6a7f9a;font-weight:600;margin-top:6px}
.tv-col-header{display:grid;grid-template-columns:2fr 1.2fr 1fr 1.2fr 1fr 48px;gap:16px;padding:0 24px;margin-bottom:8px}
.tv-col-label{font-size:10px;font-weight:800;color:#4a6080;letter-spacing:0.16em;text-transform:uppercase}
.tv-card{background:rgba(255,255,255,0.52);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.65);border-radius:20px;overflow:hidden;margin-bottom:14px;transition:box-shadow .3s;animation:slideUp .55s both}
.tv-card:hover{box-shadow:0 8px 32px rgba(0,0,0,0.08)}
.tv-card-row{display:grid;grid-template-columns:2fr 1.2fr 1fr 1.2fr 1fr 48px;align-items:center;gap:16px;padding:18px 24px;cursor:pointer;transition:background .2s}
.tv-card-row:hover{background:rgba(255,255,255,0.3)}
.tv-expand{border-top:1px solid rgba(13,27,53,0.07);background:rgba(13,27,53,0.03);padding:16px 24px 20px}
.tv-expand-row{display:grid;grid-template-columns:1.4fr 1fr 1fr 1fr 1fr;gap:16px;align-items:center;padding:14px 18px;background:rgba(255,255,255,0.6);border-radius:14px;border:1px solid rgba(255,255,255,0.7);margin-bottom:10px}
.tv-bar{height:8px;background:rgba(13,27,53,0.08);border-radius:6px;overflow:hidden}
.tv-bar-fill{height:100%;border-radius:6px;transition:width 1.2s cubic-bezier(.23,1,.32,1)}
.tv-search{padding:10px 14px 10px 34px;border-radius:12px;border:1px solid rgba(255,255,255,0.65);background:rgba(255,255,255,0.55);backdrop-filter:blur(14px);font-size:13px;font-weight:600;color:#0d1b35;outline:none;width:190px;font-family:'Outfit',sans-serif}
.tv-verify{display:inline-flex;align-items:center;gap:7px;padding:10px 18px;border-radius:12px;border:none;background:linear-gradient(135deg,#f97316,#dc2626);color:#fff;font-size:13px;font-weight:800;font-family:'Outfit','Nunito',sans-serif;cursor:pointer;box-shadow:0 6px 18px rgba(249,115,22,.32);transition:all .25s cubic-bezier(.23,1,.32,1);white-space:nowrap;text-decoration:none}
.tv-verify:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(249,115,22,.42)}
.tv-empty{background:rgba(255,255,255,0.48);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.65);border-radius:24px;padding:64px 40px;text-align:center}
.tv-footer{background:rgba(255,255,255,0.45);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,0.62);border-radius:20px;padding:18px 26px;display:flex;justify-content:space-between;align-items:center}
@media(max-width:768px){.tv-wrap{padding:16px}.tv-stats{display:grid;grid-template-columns:1fr 1fr}.tv-col-header{display:none}.tv-card-row{grid-template-columns:1fr;gap:12px}.tv-expand-row{grid-template-columns:1fr 1fr;gap:10px}.tv-header{flex-direction:column;gap:12px}.tv-footer{flex-direction:column;gap:12px;align-items:flex-start}}
`;

const EVENT_COLORS = ["#f97316","#4dd9e0","#a78bfa","#f59e0b","#34d399","#60a5fa"];

function CapacityBar({ sold, capacity, color }) {
  const pct = capacity > 0 ? Math.min((sold / capacity) * 100, 100) : 0;
  return (
    <div className="tv-bar">
      <div className="tv-bar-fill" style={{ width: `${pct}%`, background: pct > 85 ? "#f97316" : pct > 60 ? "#f59e0b" : color, boxShadow: `0 0 8px ${color}66` }} />
    </div>
  );
}

export function TicketEventCard({ event, index, onSelectPurchase }) {
  const [expanded, setExpanded] = useState(false);
  const [payouts, setPayouts] = useState(null); // { summary, rows } for this event
  const [detail, setDetail] = useState(null);    // { tickets, stats } from getTicketsByEvent
  const [detailLoading, setDetailLoading] = useState(false);
  const [showBuyers, setShowBuyers] = useState(false);

  // Prefer real-time sold counts from the tickets table (loaded lazily on
  // expand) and fall back to the ticket config attached to the event.
  const tickets = React.useMemo(() => {
    const base = event.tickets || [];
    const realTypes = detail?.stats?.ticketTypes || [];
    if (realTypes.length === 0) return base;
    return base.map((t) => {
      const real = realTypes.find(
        (st) => st.type?.toLowerCase() === (t.type || '').toLowerCase()
      );
      return real ? { ...t, sold: real.sold, ticketsSold: real.sold } : t;
    });
  }, [event.tickets, detail]);

  const buyers = detail?.tickets || [];

  // Lazily load this event's payout details the first time the card is expanded.
  useEffect(() => {
    if (!expanded || payouts !== null) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await getEventPayouts(event._id);
        if (!cancelled) setPayouts(data || { summary: null, rows: [] });
      } catch {
        if (!cancelled) setPayouts({ summary: null, rows: [] });
      }
    })();
    return () => { cancelled = true; };
  }, [expanded, payouts, event._id]);

  // Lazily load this event's real ticket stats + per-buyer list on first expand.
  // Note: detailLoading is intentionally NOT in the dependency array — including
  // it would re-run the effect the moment we flip it true, whose cleanup would
  // cancel the in-flight fetch before it resolves.
  useEffect(() => {
    if (!expanded || detail !== null) return;
    let cancelled = false;
    setDetailLoading(true);
    (async () => {
      try {
        const eventId = event._id || event.id;
        const res = await getTicketsByEvent(eventId);
        if (!cancelled) setDetail({ tickets: res?.tickets || [], stats: res?.stats || {} });
      } catch (e) {
        console.warn(`Could not fetch ticket detail for event ${event._id}:`, e.message);
        if (!cancelled) setDetail({ tickets: [], stats: {} });
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, detail, event._id, event.id]);

  const totalSold = tickets.reduce((s, t) => s + (parseInt(t.sold || t.ticketsSold) || 0), 0);
  const totalCap = tickets.reduce((s, t) => s + (parseInt(t.quantity || t.capacity) || 0), 0);
  const totalRev = tickets.reduce((s, t) => s + (parseInt(t.sold || t.ticketsSold) || 0) * (parseFloat(t.price) || 0), 0);
  const color = EVENT_COLORS[index % EVENT_COLORS.length];

  return (
    <div className="tv-card" style={{ animationDelay: `${index * 0.1 + 0.3}s` }}>
      <div className="tv-card-row" onClick={() => setExpanded(e => !e)}>
        {/* Event name */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{ width: 8, height: 36, borderRadius: 4, background: color, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#0d1b35", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{event.name}</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#f97316", marginTop: 2 }}>{event.startDate ? moment(event.startDate).format("MMM D, YYYY") : "No date"}</div>
          </div>
        </div>
        {/* Sold / Cap */}
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0d1b35", marginBottom: 6 }}>{totalSold} / {totalCap}</div>
          <CapacityBar sold={totalSold} capacity={totalCap} color={color} />
        </div>
        {/* Available */}
        <div>
          <span style={{ fontSize: 20, fontWeight: 900, color: totalCap - totalSold > 20 ? "#34d399" : "#f97316" }}>{totalCap - totalSold}</span>
          <div style={{ fontSize: 10, color: "#4a6080", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>Available</div>
        </div>
        {/* Ticket types */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {tickets.slice(0, 3).map((t, i) => (
            <span key={i} style={{ display: "inline-block", fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 8, background: `${color}18`, color, border: `1px solid ${color}30` }}>
              {t.type || `Ticket ${i + 1}`}
            </span>
          ))}
          {tickets.length > 3 && <span style={{ fontSize: 10, color: "#4a6080" }}>+{tickets.length - 3} more</span>}
        </div>
        {/* Revenue */}
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0d1b35" }}>${totalRev.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: "#4a6080", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 2 }}>Revenue</div>
        </div>
        {/* Expand */}
        <div style={{ fontSize: 18, color: "#4a6080", transition: "transform .25s", transform: expanded ? "rotate(180deg)" : "rotate(0deg)", textAlign: "center" }}>{"\u2304"}</div>
      </div>

      {expanded && (
        <div className="tv-expand">
          <div style={{ fontSize: 11, fontWeight: 800, color: "#4a6080", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 14 }}>Ticket Type Breakdown</div>
          {tickets.map((t, i) => {
            const sold = parseInt(t.sold || t.ticketsSold) || 0;
            const cap = parseInt(t.quantity || t.capacity) || 0;
            const price = parseFloat(t.price) || 0;
            const tp = cap > 0 ? Math.round((sold / cap) * 100) : 0;
            return (
              <div key={i} className="tv-expand-row">
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0d1b35" }}>{t.type || `Ticket ${i + 1}`}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color, marginTop: 2 }}>${price} / ticket</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0d1b35" }}>{sold} / {cap}</div>
                  <div style={{ fontSize: 10, color: "#4a6080", fontWeight: 600, marginTop: 2 }}>Sold / Cap</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: tp > 85 ? "#f97316" : tp > 60 ? "#f59e0b" : "#34d399" }}>{tp}%</div>
                  <div style={{ fontSize: 10, color: "#4a6080", fontWeight: 600, marginTop: 2 }}>Fill Rate</div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0d1b35" }}>{cap - sold}</div>
                  <div style={{ fontSize: 10, color: "#4a6080", fontWeight: 600, marginTop: 2 }}>Available</div>
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: "#0d1b35" }}>${(sold * price).toLocaleString()}</div>
                  <div style={{ fontSize: 10, color: "#4a6080", fontWeight: 600, marginTop: 2 }}>Revenue</div>
                </div>
              </div>
            );
          })}

          {/* ── Ticket buyers / customers for this event ── */}
          <div data-testid="event-buyers" style={{ marginTop: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#4a6080", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                {"\uD83D\uDC65"} Customers {buyers.length > 0 ? `(${buyers.length})` : ""}
              </div>
              {buyers.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBuyers((v) => !v)}
                  style={{ fontSize: 11, fontWeight: 800, color: color, background: `${color}18`, border: `1px solid ${color}30`, borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}
                >
                  {showBuyers ? "Hide" : "View buyers"}
                </button>
              )}
            </div>

            {detailLoading && (
              <div data-testid="event-buyers-loading" style={{ fontSize: 12, color: "#6a7f9a", fontWeight: 600, padding: "6px 0" }}>
                Loading customers…
              </div>
            )}

            {!detailLoading && buyers.length === 0 && (
              <div data-testid="event-buyers-empty" style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, padding: "6px 0" }}>
                No tickets purchased for this event yet.
              </div>
            )}

            {showBuyers && buyers.length > 0 && (
              <div>
                {buyers.map((t) => {
                  const p = ticketToPurchase(t);
                  const cancelled = (p.status || "").toLowerCase() === "cancelled" || (p.status || "").toLowerCase() === "refunded";
                  return (
                    <div
                      key={p.confirmationNumber || t._id}
                      data-testid="event-buyer-row"
                      onClick={() => onSelectPurchase && onSelectPurchase(p)}
                      style={{ display: "grid", gridTemplateColumns: "1.6fr 1.2fr 0.9fr 0.9fr 0.7fr", gap: 12, alignItems: "center", padding: "12px 16px", background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.7)", borderRadius: 12, marginBottom: 8, cursor: "pointer", transition: "background .2s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.85)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.6)")}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "#0d1b35", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.customerName}</div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "#6a7f9a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.customerEmail || "—"}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: color }}>{t.ticketType || "General Admission"}</div>
                        <div style={{ fontSize: 10, color: "#4a6080", fontWeight: 600, marginTop: 2 }}>#{p.confirmationNumber}</div>
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0d1b35" }}>${p.totalAmount}</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: "#6a7f9a" }}>{p.purchaseDate}</div>
                      <div>
                        <span style={{ fontSize: 10, fontWeight: 800, padding: "3px 9px", borderRadius: 8, background: cancelled ? "rgba(220,38,38,0.12)" : "rgba(52,211,153,0.14)", color: cancelled ? "#DC2626" : "#059669", border: `1px solid ${cancelled ? "rgba(220,38,38,0.25)" : "rgba(52,211,153,0.3)"}`, textTransform: "capitalize" }}>
                          {p.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Payout details (journal-derived) for this event ── */}
          {payouts && (payouts.summary || (payouts.rows && payouts.rows.length > 0)) && (
            <div data-testid="event-payout-details" style={{ marginTop: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#4a6080", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
                Your Payouts
              </div>
              {payouts.summary && (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                  <div data-testid="event-payout-outstanding" style={{ flex: "1 1 140px", background: "rgba(167,139,250,0.12)", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, color: "#6a7f9a", fontWeight: 700 }}>Available to pay out</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#7c3aed" }}>{fmtCents(payouts.summary.outstandingPayableCents, payouts.summary.currency)}</div>
                  </div>
                  <div style={{ flex: "1 1 140px", background: "rgba(255,255,255,0.6)", borderRadius: 12, padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, color: "#6a7f9a", fontWeight: 700 }}>Earned from this event</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#0d1b35" }}>{fmtCents(payouts.summary.lifetimeEarnedCents, payouts.summary.currency)}</div>
                  </div>
                </div>
              )}
              {payouts.rows && payouts.rows.length > 0 ? (
                payouts.rows.map((row) => (
                  <div
                    key={row.transactionId}
                    data-testid="event-payout-row"
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "rgba(255,255,255,0.6)", borderRadius: 12, marginBottom: 8 }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0d1b35" }}>{row.type === "SALE" ? "Ticket sale" : row.type}</div>
                      <div style={{ fontSize: 11, color: "#9CA3AF", fontWeight: 600 }}>{row.effectiveAt ? moment(row.effectiveAt).format("MMM D, YYYY") : ""}</div>
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: row.organizerAmountCents >= 0 ? "#059669" : "#DC2626" }}>
                      {row.organizerAmountCents >= 0 ? "+" : ""}{fmtCents(row.organizerAmountCents, row.currency)}
                    </div>
                  </div>
                ))
              ) : (
                <div data-testid="event-payout-empty" style={{ fontSize: 12, color: "#9CA3AF", fontWeight: 600, padding: "6px 0" }}>
                  No payouts recorded for this event yet.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const MyTicketsView = () => {
  const [events, setEvents] = useState([]);
  const [, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPurchase, setSelectedPurchase] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const userId = getCurrentUserId();
        if (!userId) { setLoading(false); return; }

        const savedBizId = sessionStorage.getItem("selectedBusinessId");

        const res = await getEventsByUserId(userId);
        const allEvents = res.data || [];
        // The backend already scopes events to the selected business partition
        // (via the X-Business-Id header), so we only need to keep the ones that
        // have Tabs tickets enabled.
        const withTickets = allEvents.filter(ev =>
          ev.tickets && ev.tickets.length > 0 &&
          ev.tickets.some(t => t.option === 'Tabs Tickets' || t.option === 'Tickets with Tabs')
        );

        console.info(
          `[Tickets] fetched=${allEvents.length} withTabsTickets=${withTickets.length} ` +
          `savedBizId=${savedBizId || 'none'}`
        );

        // Render the list immediately using the ticket config already attached
        // to each event. Real-time sold counts and the per-buyer list are loaded
        // lazily per event when a card is expanded (see TicketEventCard), which
        // avoids an N+1 request fan-out that previously blocked the whole page
        // on the slowest full-table scan.
        setEvents(withTickets);
      } catch (e) { console.error("Tickets load error:", e); }
      setLoading(false);
    };
    load();
  }, []);

  const filtered = events.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
  const totalRevenue = filtered.reduce((s, e) => s + (e.tickets || []).reduce((ts, t) => ts + (parseInt(t.sold || t.ticketsSold) || 0) * (parseFloat(t.price) || 0), 0), 0);
  const totalSold = filtered.reduce((s, e) => s + (e.tickets || []).reduce((ts, t) => ts + (parseInt(t.sold || t.ticketsSold) || 0), 0), 0);
  const totalCap = filtered.reduce((s, e) => s + (e.tickets || []).reduce((ts, t) => ts + (parseInt(t.quantity || t.capacity) || 0), 0), 0);
  const avgPrice = totalSold > 0 ? totalRevenue / totalSold : 0;

  // Open the ticket verification app with the current session so the operator
  // isn't forced to log in again. The verify app accepts token + userId query
  // params for cross-subdomain SSO (same handoff the team-member login uses).
  const openVerifyApp = () => {
    const base = 'https://verify.ticket.keeptabs.app';
    const token = localStorage.getItem('idToken');
    const userId = getCurrentUserId();
    const url = token && userId ? buildAuthenticatedReturnUrl(base, token, userId) : base;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Drill into a single customer's purchase for service actions.
  if (selectedPurchase) {
    return (
      <CustomerServiceView
        purchase={selectedPurchase}
        onBack={() => setSelectedPurchase(null)}
      />
    );
  }

  // Render the shell immediately — the Router's Suspense fallback already
  // covered chunk load, and a second full-screen spinner here just stacks
  // a loader on top of a loader.
  // (Was: if (loading) return <MTBLoading />.)

  return (
    <>
      <style>{S}</style>
      <div className="tv-wrap">
        <div className="tv-inner">
          {/* Header */}
          <div className="tv-header">
            <div>
              <div className="tv-title">Ticket <span style={{ color: "#f97316" }}>Management</span></div>
              <div className="tv-subtitle">Manage ticket sales, capacity and revenue across all events</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#4a6080" }}>{"\u2315"}</span>
                <input className="tv-search" placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <button type="button" className="tv-verify" onClick={openVerifyApp}>
                Verify Tickets
              </button>
            </div>
          </div>

          {/* Stat Cards */}
          <div className="tv-stats">
            {[
              { icon: "\uD83D\uDCB0", label: "Total Revenue", val: `$${totalRevenue.toLocaleString()}`, color: "#34d399", gradient: "linear-gradient(135deg,#34d399,#059669)" },
              { icon: "\uD83C\uDF9F", label: "Tickets Sold", val: totalSold, color: "#4dd9e0", gradient: "linear-gradient(135deg,#4dd9e0,#0891b2)" },
              { icon: "\uD83D\uDED2", label: "Events w/ Tickets", val: filtered.length, color: "#a78bfa", gradient: "linear-gradient(135deg,#a78bfa,#7c3aed)" },
              { icon: "\u2300", label: "Avg. Ticket Price", val: `$${avgPrice.toFixed(2)}`, color: "#f97316", gradient: "linear-gradient(135deg,#f97316,#dc2626)" },
            ].map((s, i) => (
              <div key={i} className="tv-stat" style={{ animationDelay: `${i * 80}ms` }}>
                <div className="tv-stat-bar" style={{ background: s.gradient }} />
                <div className="tv-stat-icon" style={{ background: s.gradient, boxShadow: `0 6px 18px ${s.color}40` }}>{s.icon}</div>
                <div className="tv-stat-label">{s.label}</div>
                <div className="tv-stat-val">{s.val}</div>
              </div>
            ))}
          </div>

          {/* Column headers */}
          {filtered.length > 0 && (
            <div className="tv-col-header">
              {["Event Name", "Sold / Capacity", "Available", "Ticket Types", "Revenue", ""].map((h, i) => (
                <div key={i} className="tv-col-label">{h}</div>
              ))}
            </div>
          )}

          {/* Event cards or empty state */}
          {filtered.length > 0 ? (
            filtered.map((ev, i) => <TicketEventCard key={ev._id} event={ev} index={i} onSelectPurchase={setSelectedPurchase} />)
          ) : (
            <div className="tv-empty">
              <div style={{ width: 80, height: 80, borderRadius: 24, background: "linear-gradient(135deg,rgba(77,217,224,0.18),rgba(249,115,22,0.12))", border: "1.5px solid rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 24px" }}>{"\uD83C\uDF9F"}</div>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: "#0d1b35", marginBottom: 10 }}>No Events with Ticketing Enabled</h3>
              <p style={{ fontSize: 14, color: "#4a6080", fontWeight: 600, maxWidth: 380, margin: "0 auto 28px", lineHeight: 1.7 }}>
                Enable "Tickets with Tabs" on your events to manage ticket sales here.
              </p>
            </div>
          )}

          {/* Footer */}
          {filtered.length > 0 && (
            <div className="tv-footer" style={{ marginTop: 14 }}>
              <div style={{ fontSize: 13, color: "#2a4a6e", fontWeight: 700 }}>
                Showing {filtered.length} event{filtered.length !== 1 ? "s" : ""} with ticketing
              </div>
              <div style={{ display: "flex", gap: 20 }}>
                {[
                  { label: "Total Capacity", val: totalCap },
                  { label: "Remaining", val: totalCap - totalSold },
                  { label: "Overall Fill", val: totalCap > 0 ? `${Math.round((totalSold / totalCap) * 100)}%` : "0%" },
                ].map((s, i) => (
                  <div key={i} style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: "#4a6080", letterSpacing: "0.12em", textTransform: "uppercase" }}>{s.label}</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#0d1b35" }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default MyTicketsView;
