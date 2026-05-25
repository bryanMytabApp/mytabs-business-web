import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { parseJwt } from "../../utils/common";
import { getUserById } from "../../services/userService";
import { getBusiness } from "../../services/businessService";
import {
  getMyOrganizations,
  getOrganizationMembers,
  getOrganizationBusinesses,
} from "../../services/organizationService";

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
  const [user, setUser] = useState(null);
  const [business, setBusiness] = useState(null);
  const [org, setOrg] = useState(null);            // { id, name, role }
  const [loading, setLoading] = useState(true);
  const wrapRef = useRef(null);

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
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
        className={`th-profile-btn${open ? " th-profile-btn-open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="th-avatar" aria-hidden="true">{initials}</span>
        <span className="th-profile-name">{loading ? "…" : displayName}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className="th-caret">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="th-profile-menu" role="menu">
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
                <dd title={business.name}>{business.name}</dd>
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

          <div className="th-profile-divider" />

          <button
            type="button"
            className="th-profile-link th-profile-link-danger"
            role="menuitem"
            onClick={() => { setOpen(false); if (onSignOut) onSignOut(); }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
