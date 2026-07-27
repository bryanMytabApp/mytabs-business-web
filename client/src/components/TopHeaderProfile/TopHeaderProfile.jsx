import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { useNavigate } from "react-router-dom";

import { parseJwt } from "../../utils/common";
import { getUserById } from "../../services/userService";
import { getBusiness } from "../../services/businessService";
import {
  getMyOrganizations,
  getOrganizationMembers,
  getOrganizationBusinesses,
} from "../../services/organizationService";
import FeedbackDialog from "../FeedbackDialog/FeedbackDialog";

/**
 * TopHeaderProfile
 *
 * The right-hand cluster of the top bar. Mirrors the AWS console pattern:
 *
 *   [ ? ]  [ User Name ▼ ]
 *
 * Clicking "?" toggles the doc-sync help panel (the SDK is mounted in
 * headless mode at the AppLayout level, so it has no built-in trigger
 * button — this component is its trigger).
 *
 * Clicking the user pill opens a small popover with profile / business /
 * role info plus quick links to the relevant Configuration sub-sections.
 *
 * Data flow:
 *   - User: idToken → parseJwt → /user/:userId
 *   - Org / Role: /organization/my → first org's `name` and `role`
 *           ('owner' | 'admin' | 'member').
 *   - Business: derived in this order, mirroring TeamSection:
 *       1. /organization/:id/members → look up THIS user's `businessId`,
 *          then resolve the matching business in the org's business list.
 *       2. If the user is the org owner with no member record, treat the
 *          org itself as the primary business (matches existing behavior).
 *       3. Fallback: /business/:userId for users without an org.
 *     This is what produces "DownTown (Test)" for vsmike2500@hotmail —
 *     they're a member of the org, assigned to the DownTown business.
 *
 * We deliberately don't depend on UserDataProvider — that provider is a
 * stub that doesn't actually load anything, and the rest of the codebase
 * fetches users on demand. Mirroring that pattern keeps things consistent.
 *
 * Props:
 *   onSignOut() - parent-supplied logout handler. We don't clear tokens
 *                 ourselves so HomeView can keep its existing confirmation
 *                 dialog + cleanup.
 */
export default function TopHeaderProfile({ onSignOut }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [org, setOrg] = useState(null);            // { id, name, role }
  const [allBusinesses, setAllBusinesses] = useState([]); // For business switcher
  const [selectedBusinessId, setSelectedBusinessId] = useState(sessionStorage.getItem("selectedBusinessId") || null);
  const [switchingBusiness, setSwitchingBusiness] = useState(false); // Edit mode for business
  const [pendingBusinessId, setPendingBusinessId] = useState(null); // Pending selection before confirm
  const [bizSearch, setBizSearch] = useState(""); // Typeahead search text
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const helpBtnRef = useRef(null);
  const sendSuggestionsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    const idToken = localStorage.getItem("idToken");
    const userId = parseJwt(idToken) || localStorage.getItem("username");
    if (!userId) { setLoading(false); return; }

    (async () => {
      // Always pull the user record first — gives us name + email.
      try {
        const userRes = await getUserById(userId);
        if (cancelled) return;
        setUser(userRes?.data || userRes || null);
      } catch (e) {
        console.warn("[TopHeaderProfile] getUserById failed", e);
      }

      // Org membership: gives us role + org name + (via members) business.
      let resolvedOrg = null;
      let resolvedBiz = null;
      try {
        const orgRes = await getMyOrganizations();
        if (cancelled) return;
        const orgs = orgRes?.data?.organizations || orgRes?.data || [];
        if (orgs.length > 0) {
          const o = orgs[0];
          resolvedOrg = {
            id: o.organizationId || o.id || o._id,
            name: o.name || "",
            role: (o.role || "member").toLowerCase(),
          };

          // Resolve the user's assigned business through the org member
          // record, then look it up in the org's business list. This is
          // the same pattern TeamSection uses, so the Business shown here
          // matches what the user sees on the Team page (e.g. an admin
          // assigned to "DownTown" sees "DownTown" here).
          try {
            const [memRes, bizListRes] = await Promise.all([
              getOrganizationMembers(resolvedOrg.id).catch(() => null),
              getOrganizationBusinesses(resolvedOrg.id).catch(() => null),
            ]);
            if (cancelled) return;
            const members = memRes?.data?.members || memRes?.data || [];
            const businesses = bizListRes?.data?.businesses || bizListRes?.data || [];

            // Build the full business list for the switcher
            const bizList = [];
            if (resolvedOrg.role === 'owner') {
              // Primary = the organization itself
              // Use the org name and the user's own userId (matches JWT → no org verification needed)
              // Events and other data are stored under this userId
              bizList.push({ linkedBusinessId: userId, name: resolvedOrg.name, isPayer: true });
            }
            bizList.push(...businesses.filter(b => {
              const id = b.linkedBusinessId || b._id;
              // Exclude the user's own ID (already the Primary entry)
              return id !== userId;
            }).map(b => ({ ...b, isPayer: false })));
            setAllBusinesses(bizList);

            // Default selection if none saved
            const savedBiz = sessionStorage.getItem("selectedBusinessId");
            console.log("[TopHeaderProfile] savedBiz:", savedBiz, "bizList:", bizList.map(b => ({ id: b.linkedBusinessId, name: b.name })));
            if (savedBiz && bizList.some(b => (b.linkedBusinessId || b._id) === savedBiz)) {
              setSelectedBusinessId(savedBiz);
              // Sync displayed business name — fetch actual name from API for accuracy
              try {
                const bizDataRes = await getBusiness(savedBiz);
                const bizData = bizDataRes?.data || bizDataRes;
                if (bizData?.name || bizData?.businessName) {
                  resolvedBiz = { name: bizData.name || bizData.businessName };
                } else {
                  const selectedBiz = bizList.find(b => (b.linkedBusinessId || b._id) === savedBiz);
                  if (selectedBiz) resolvedBiz = { name: selectedBiz.name || "" };
                }
              } catch (e) {
                const selectedBiz = bizList.find(b => (b.linkedBusinessId || b._id) === savedBiz);
                if (selectedBiz) resolvedBiz = { name: selectedBiz.name || "" };
              }
            } else if (bizList.length > 0) {
              // Only set default if nothing is saved — never overwrite an existing value
              if (!savedBiz) {
                console.log("[TopHeaderProfile] No savedBiz, defaulting to first:", bizList[0].linkedBusinessId);
                const defaultId = bizList[0].linkedBusinessId || bizList[0]._id;
                setSelectedBusinessId(defaultId);
                sessionStorage.setItem("selectedBusinessId", defaultId);
              } else {
                // savedBiz exists but doesn't match list — keep it, don't overwrite
                console.log("[TopHeaderProfile] savedBiz not in list, keeping as-is:", savedBiz);
                setSelectedBusinessId(savedBiz);
              }
              resolvedBiz = { name: bizList[0].name || "" };
            }

            const me = members.find((m) => m.userId === userId);
            if (me?.businessId) {
              const biz = businesses.find(
                (b) => (b.linkedBusinessId || b._id || b.id) === me.businessId
              );
              if (biz) {
                resolvedBiz = { name: biz.name || biz.businessName || "" };
              }
            }
            // Owner with no explicit business assignment → org is the biz.
            if (!resolvedBiz && resolvedOrg.role === "owner") {
              resolvedBiz = { name: resolvedOrg.name };
            }
          } catch (e) {
            // Member/business resolution is best-effort; keep going.
          }
        }
      } catch (e) {
        // No org — biz fallback will run below.
      }

      // Final fallback: solo user with no org but a personal business record.
      if (!resolvedBiz) {
        try {
          const bizRes = await getBusiness(userId);
          if (cancelled) return;
          const b = bizRes?.data || bizRes;
          if (b?.businessName || b?.name) {
            resolvedBiz = { name: b.businessName || b.name };
          }
        } catch (e) {
          // Many users won't have a business yet — silent.
        }
      }

      if (cancelled) return;
      setOrg(resolvedOrg);
      setBusiness(resolvedBiz);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  // Close the dropdown when clicking outside or pressing Escape.
  useEffect(() => {
    if (!open && !helpOpen) return;
    const onDoc = (e) => {
      if (wrapRef.current && wrapRef.current.contains(e.target)) return;
      const menu = document.querySelector('.th-profile-menu');
      if (menu && menu.contains(e.target)) return;
      const supportMenu = document.querySelector('.th-support-menu');
      if (supportMenu && supportMenu.contains(e.target)) return;
      setOpen(false);
      setHelpOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") { setOpen(false); setHelpOpen(false); } };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, helpOpen]);

  const displayName = useMemo(() => {
    if (!user) return "Account";
    const composed = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
    return user.displayName || composed || user.username || user.email || "Account";
  }, [user]);

  const initials = useMemo(() => {
    const src = (user?.firstName || user?.lastName)
      ? `${user?.firstName || ""} ${user?.lastName || ""}`
      : (user?.displayName || user?.email || "U");
    const parts = src.trim().split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0]?.toUpperCase()).join("") || "U";
  }, [user]);

  // Role lives on the org membership ('owner' | 'admin' | 'member').
  // Owner-or-admin role on a non-org user defaults to "Member".
  const role = (org?.role || "member").toString().toLowerCase();
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  const handleHelpClick = () => {
    if (window.tabsHelp && typeof window.tabsHelp.toggle === "function") {
      window.tabsHelp.toggle();
    } else {
      console.warn("[TopHeaderProfile] help SDK not ready yet");
    }
  };

  const handleBusinessSwitch = (bizId) => {
    setSelectedBusinessId(bizId);
    sessionStorage.setItem("selectedBusinessId", bizId);
    // Update displayed business name
    const biz = allBusinesses.find(b => (b.linkedBusinessId || b._id) === bizId);
    if (biz) setBusiness({ name: biz.name || biz.businessName || "" });
    // Notify other components of the business context change
    window.dispatchEvent(new CustomEvent("businessContextChanged", { detail: { businessId: bizId } }));
    // Force full page reload to re-fetch all data with new business context
    if (window.location.pathname === "/admin/home") {
      window.location.reload();
    } else {
      window.location.href = "/admin/home";
    }
  };

  const goTo = (hash) => {
    setOpen(false);
    const target = "/admin/configuration";
    if (window.location.pathname === target) {
      // Already on Configuration — set the hash directly so the page's
      // native `hashchange` listener fires and swaps the active section.
      // (react-router's navigate() uses pushState which does NOT fire
      // hashchange, so going through navigate() here would silently fail.)
      if (window.location.hash === "#" + hash) return;
      window.location.hash = hash;
    } else {
      // Different page — react-router handles the navigate, and
      // SettingsContext reads window.location.hash in its initial state
      // when it mounts, so the section is selected on first paint.
      navigate(`${target}#${hash}`);
    }
  };

  return (
    <div className="th-topright" ref={wrapRef}>
      {/* Support icon — headset icon with dropdown menu (AWS-style) */}
      <button
        type="button"
        ref={helpBtnRef}
        className={`th-help-btn${helpOpen ? " th-help-btn-active" : ""}`}
        onClick={() => { setHelpOpen((o) => !o); setOpen(false); }}
        aria-label="Support"
        title="Support"
        aria-haspopup="menu"
        aria-expanded={helpOpen}
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 16v-2a6 6 0 0 0-12 0v2" />
          <path d="M4 16a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2z" />
          <path d="M20 16a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2h0a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2z" />
          <path d="M18 16v1a3 3 0 0 1-3 3h-2" />
        </svg>
      </button>

      {helpOpen && ReactDOM.createPortal(
        <div className="th-support-menu" role="menu" style={{
          position: 'fixed',
          top: helpBtnRef.current ? helpBtnRef.current.getBoundingClientRect().bottom + 8 : 60,
          right: Math.max(8, window.innerWidth - (helpBtnRef.current ? helpBtnRef.current.getBoundingClientRect().right : window.innerWidth)),
        }}>
          <div className="th-support-header">
            <span>Support</span>
            <a href="https://help.keeptabs.app" target="_blank" rel="noopener noreferrer" className="th-support-ext" aria-label="Open support in new tab">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          </div>
          <div className="th-support-divider" />
          <button type="button" className="th-support-link" role="menuitem" onClick={() => { setHelpOpen(false); window.open("mailto:support@keeptabs.app", "_blank"); }}>
            Support Center
          </button>
          <div className="th-support-divider" />
          <button type="button" className="th-support-link" role="menuitem" onClick={() => { setHelpOpen(false); handleHelpClick(); }}>
            Documentation
          </button>
          <button type="button" className="th-support-link" role="menuitem" onClick={() => { setHelpOpen(false); navigate("/admin/configuration#billing"); }}>
            Getting Started
          </button>
          <div className="th-support-divider" />
          <button type="button" className="th-support-link th-support-link-feedback" role="menuitem" onClick={() => { setHelpOpen(false); setFeedbackOpen(true); }}>
            Send feedback
          </button>
        </div>,
      document.body)}

      {/* Help "?" — outline by default, fills blue when the panel is open.
          We detect "open" by inspecting the SDK state; safe to skip if missing. */}
      <button
        type="button"
        className="th-help-btn"
        onClick={handleHelpClick}
        aria-label="Open help"
        title="Help"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="12" cy="17" r="1" fill="currentColor" />
        </svg>
      </button>

      <button
        type="button"
        ref={btnRef}
        className={`th-profile-btn${open ? " th-profile-btn-open" : ""}`}
        onClick={() => { setOpen((o) => !o); setHelpOpen(false); }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="th-avatar" aria-hidden="true">{initials}</span>
        <span className="th-profile-name">{loading ? "…" : displayName}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className="th-caret">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && ReactDOM.createPortal(
        <div className="th-profile-menu" role="menu" style={{
          position: 'fixed',
          top: btnRef.current ? btnRef.current.getBoundingClientRect().bottom + 8 : 60,
          right: Math.max(8, window.innerWidth - (btnRef.current ? btnRef.current.getBoundingClientRect().right : window.innerWidth)),
        }}>
          <div className="th-profile-head">
            <div className="th-avatar th-avatar-lg" aria-hidden="true">{initials}</div>
            <div className="th-profile-id">
              <div className="th-profile-name-lg">{displayName}</div>
              {user?.email && <div className="th-profile-email" title={user.email}>{user.email}</div>}
            </div>
          </div>

          <dl className="th-profile-meta">
            {business?.name && (
              <>
                <dt>Business</dt>
                <dd title={business.name}>
                  {allBusinesses.length > 1 ? (
                    switchingBusiness ? (
                      <span style={{ fontSize: 12, color: '#4F46E5', fontWeight: 600 }}>Switching...</span>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span
                            onClick={() => setSwitchingBusiness(true)}
                            style={{ fontWeight: 500, color: '#4F46E5', cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted', textUnderlineOffset: '3px' }}
                            title="Click to switch business"
                          >
                            {business.name}
                          </span>
                        </div>
                      </div>
                    )
                  ) : business.name}
                </dd>
              </>
            )}
            {(org?.name || user?.organizationName) && (
              <>
                <dt>Organization</dt>
                <dd>{org?.name || user?.organizationName}</dd>
              </>
            )}
            <dt>Role</dt>
            <dd>{roleLabel}</dd>
            {user?.timezone && (
              <>
                <dt>Time zone</dt>
                <dd>{user.timezone}</dd>
              </>
            )}
          </dl>

          <div className="th-profile-divider" />

          <button type="button" className="th-profile-link" role="menuitem" onClick={() => goTo("profile")}>
            Profile
          </button>
          <button type="button" className="th-profile-link" role="menuitem" onClick={() => goTo("organization")}>
            Organization
          </button>
          <button type="button" className="th-profile-link" role="menuitem" onClick={() => goTo("billing")}>
            Billing
          </button>
          <button type="button" className="th-profile-link" role="menuitem" onClick={() => goTo("security")}>
            Security
          </button>
          <button type="button" ref={sendSuggestionsRef} className="th-profile-link" role="menuitem" onClick={() => { setFeedbackOpen(true); setOpen(false); }}>
            Send Suggestions
          </button>

          <div className="th-profile-divider" />

          <button
            type="button"
            className="th-profile-link th-profile-link-danger"
            role="menuitem"
            onClick={() => { setOpen(false); if (onSignOut) onSignOut(); }}
          >
            Sign out
          </button>
        </div>,
      document.body)}

      {/* Business Switcher Modal */}
      {switchingBusiness && ReactDOM.createPortal(
        <div
          onClick={() => { setSwitchingBusiness(false); setPendingBusinessId(null); setBizSearch(""); }}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 99999,
            animation: 'th-prof-fade .15s ease-out',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, padding: 24, width: '90%',
              maxWidth: 400, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
              fontFamily: "'Outfit', sans-serif",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Switch Business</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Select which business you want to manage</div>

            <input
              type="text"
              value={bizSearch}
              onChange={(e) => setBizSearch(e.target.value)}
              placeholder="Search businesses..."
              autoFocus
              style={{
                padding: '10px 14px', borderRadius: 8, border: '1.5px solid #E5E7EB',
                fontSize: 14, fontFamily: "'Outfit', sans-serif", fontWeight: 500,
                backgroundColor: '#F9FAFB', color: '#111827', width: '100%',
                outline: 'none', marginBottom: 12, boxSizing: 'border-box',
              }}
              onFocus={(e) => { e.target.style.borderColor = '#4F46E5'; e.target.style.backgroundColor = '#fff'; }}
              onBlur={(e) => { e.target.style.borderColor = '#E5E7EB'; e.target.style.backgroundColor = '#F9FAFB'; }}
            />

            <div style={{
              maxHeight: 240, overflowY: 'auto', border: '1px solid #E5E7EB',
              borderRadius: 8, marginBottom: 16,
            }}>
              {allBusinesses
                .filter(biz => !bizSearch || (biz.name || '').toLowerCase().includes(bizSearch.toLowerCase()))
                .map(biz => {
                  const bizId = biz.linkedBusinessId || biz._id;
                  const isActive = bizId === selectedBusinessId;
                  const isPending = bizId === pendingBusinessId;
                  return (
                    <div
                      key={bizId}
                      onClick={() => setPendingBusinessId(bizId)}
                      style={{
                        padding: '10px 14px', fontSize: 14, fontWeight: isPending ? 700 : 500,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        backgroundColor: isPending ? '#EEF2FF' : 'transparent',
                        color: isPending ? '#4F46E5' : '#111827',
                        borderBottom: '1px solid #F3F4F6',
                        transition: 'background-color 0.1s',
                      }}
                    >
                      <span>{biz.name}{biz.isPayer ? ' (Primary)' : ''}</span>
                      {isActive && !isPending && <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>Current</span>}
                      {isPending && <span style={{ fontSize: 11, color: '#4F46E5', fontWeight: 700 }}>✓</span>}
                    </div>
                  );
                })
              }
              {allBusinesses.filter(biz => !bizSearch || (biz.name || '').toLowerCase().includes(bizSearch.toLowerCase())).length === 0 && (
                <div style={{ padding: '14px', fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>No businesses match your search</div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={() => { setSwitchingBusiness(false); setPendingBusinessId(null); setBizSearch(""); }}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: '1px solid #E5E7EB',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  backgroundColor: '#fff', color: '#374151', fontFamily: "'Outfit', sans-serif",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!pendingBusinessId || pendingBusinessId === selectedBusinessId}
                onClick={() => {
                  if (pendingBusinessId && pendingBusinessId !== selectedBusinessId) {
                    handleBusinessSwitch(pendingBusinessId);
                  }
                  setSwitchingBusiness(false);
                  setPendingBusinessId(null);
                  setBizSearch("");
                }}
                style={{
                  padding: '8px 18px', borderRadius: 8, border: 'none',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  backgroundColor: (!pendingBusinessId || pendingBusinessId === selectedBusinessId) ? '#C7D2FE' : '#4F46E5',
                  color: '#fff', fontFamily: "'Outfit', sans-serif",
                }}
              >
                Confirm Switch
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <FeedbackDialog
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        triggerRef={sendSuggestionsRef}
      />
    </div>
  );
}
