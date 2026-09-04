import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { setHelpRoute, getPendingHelpRoute } from "./helpRoute";

/**
 * TabsHelp
 *
 * Thin React wrapper around the vanilla doc-sync SDK. Mounts the SDK
 * once at app root, then calls setRoute() on every react-router change.
 *
 * Place at the top of <Router> (alongside other one-time init like
 * ToastContainer). Use exactly once per app.
 *
 * The SDK script is loaded from the same CloudFront distribution that
 * serves the rest of the app, so it's a same-origin <script> with no
 * extra DNS / TLS handshake. Minified bundle is ~11 KB gzipped.
 *
 * Props:
 *   apiUrl    - GET /help/context endpoint. Required.
 *   chatUrl   - POST /help/chat endpoint. Optional. When provided, the panel
 *               shows a chat box under the doc content.
 *   role      - One of: 'public' | 'business-owner' | 'org-admin' (default: 'public')
 *   brand     - Title shown in the panel header (default: 'Help')
 *   headless  - When true, the SDK does NOT render a floating button. The host
 *               app is expected to call window.tabsHelp.toggle() from its own
 *               UI (e.g. a topbar "?" icon).
 *   onReady   - Optional callback fired with the SDK handle once it has booted.
 *               Useful for triggering it from a parent component.
 */
export default function TabsHelp({ apiUrl, chatUrl, role = "public", brand = "Help", headless = false, panelTopOffset = 0, helpSiteUrl = "", helpSitePathPrefix = "web/", onReady }) {
  const helpRef = useRef(null);
  const location = useLocation();

  // Mount once on first render
  useEffect(() => {
    if (helpRef.current) return; // already mounted (StrictMode double-effect guard)

    let cancelled = false;

    // Inject the SDK <script>. Idempotent — if it's already present we
    // just wait for window.TabsHelp to exist.
    const SCRIPT_ID = "tabs-help-sdk";
    let scriptEl = document.getElementById(SCRIPT_ID);
    if (!scriptEl) {
      scriptEl = document.createElement("script");
      scriptEl.id = SCRIPT_ID;
      scriptEl.src = "/help-sdk/tabs-help.min.js";
      scriptEl.async = true;
      document.head.appendChild(scriptEl);
    }

    function whenReady(cb) {
      if (window.TabsHelp && typeof window.TabsHelp.init === "function") return cb();
      // Poll briefly for the script to finish executing
      const start = Date.now();
      const id = setInterval(() => {
        if (cancelled) { clearInterval(id); return; }
        if (window.TabsHelp && typeof window.TabsHelp.init === "function") {
          clearInterval(id); cb();
        } else if (Date.now() - start > 8000) {
          clearInterval(id);
          console.warn("[TabsHelp] SDK failed to load within 8s");
        }
      }, 50);
    }

    whenReady(() => {
      if (cancelled) return;
      try {
        helpRef.current = window.TabsHelp.init({ apiUrl, chatUrl, role, brand, headless, panelTopOffset, helpSiteUrl, helpSitePathPrefix });
        // Expose globally so any header/menu component can drive it without
        // prop-drilling. Safe — there's only ever one help instance per app.
        // Set this BEFORE the initial setRoute so buffered pushes see it ready.
        window.tabsHelp = helpRef.current;
        // Replay the app's intended route if a screen asked for one (via
        // setHelpRoute) while the SDK was still loading — the common cold-load /
        // private-mode case where those calls would otherwise have been dropped.
        // Screens that write a hash via replaceState (Admin Portal tabs, the
        // pricing/event wizards) are invisible to react-router's useLocation,
        // so the buffer is the source of truth when present. Fall back to the
        // router location for a direct landing (e.g. /admin/configuration#profile).
        const pending = getPendingHelpRoute();
        helpRef.current.setRoute(pending || location.pathname + (location.hash || ""));
        if (typeof onReady === "function") onReady(helpRef.current);
      } catch (e) {
        console.warn("[TabsHelp] init failed:", e);
      }
    });

    return () => {
      cancelled = true;
      if (helpRef.current && typeof helpRef.current.destroy === "function") {
        helpRef.current.destroy();
        helpRef.current = null;
      }
      if (window.tabsHelp && !helpRef.current) {
        try { delete window.tabsHelp; } catch { window.tabsHelp = null; }
      }
    };
    // We deliberately do NOT depend on apiUrl/role/brand — those are static
    // for the lifetime of the app. If they change, remount the component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Push every route change down to the SDK. We include the hash so
  // multi-section pages like /admin/configuration#organization can have
  // one help doc per section. Route through setHelpRoute so the shared
  // buffer stays in sync with what's actually displayed (and so a push
  // that arrives before the SDK boots is replayed rather than dropped).
  useEffect(() => {
    setHelpRoute(location.pathname + (location.hash || ""));
  }, [location.pathname, location.hash]);

  return null;
}
