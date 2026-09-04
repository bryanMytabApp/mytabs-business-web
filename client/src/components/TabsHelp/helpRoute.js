/**
 * helpRoute — resilient bridge between the app and the TabsHelp SDK.
 *
 * WHY THIS EXISTS
 * ---------------
 * Several screens drive the Help panel's context by writing a URL hash with
 * `window.history.replaceState(...)` and then telling the SDK about it. React
 * Router never sees a replaceState hash change, so the TabsHelp wrapper (which
 * reads `useLocation()`) cannot recover it — the ONLY thing that carries these
 * per-tab / per-wizard-step routes to the SDK is a direct `setRoute()` call.
 *
 * The old call sites did:
 *
 *     if (window.tabsHelp && typeof window.tabsHelp.setRoute === 'function') {
 *       window.tabsHelp.setRoute(route);
 *     }
 *
 * On a COLD load (e.g. a fresh incognito window where `/help-sdk/tabs-help.min.js`
 * isn't cached yet) the SDK bundle is still downloading when these effects fire,
 * so `window.tabsHelp` is undefined and the call is silently dropped. The panel
 * then falls back to the react-router route (no hash) or an empty hash, which
 * has no doc, and the user sees "No help written for this page yet." In a warm
 * window the bundle is cached and boots first, so the call lands — which is why
 * the bug only reproduces in private mode / first visit.
 *
 * THE FIX
 * -------
 * Always remember the LAST route the app asked for in a module-level buffer
 * (mirrored on `window` so it survives across the lazy-loaded chunks). Push it
 * to the SDK if it's ready; otherwise the TabsHelp wrapper replays the buffer
 * the moment the SDK finishes booting (see TabsHelp.jsx). Result: the route the
 * app wants is never lost to a boot race.
 */

const BUFFER_KEY = '__tabsHelpPendingRoute';

function pathOf(route) {
  const i = String(route).indexOf('#');
  return i >= 0 ? String(route).slice(0, i) : String(route);
}

function hasHash(route) {
  return String(route).indexOf('#') >= 0;
}

/**
 * Record the desired help route and forward it to the SDK if it's ready.
 * Safe to call before the SDK has loaded — the route is buffered and replayed
 * on boot. Safe in non-browser/test environments (guards `window`).
 *
 * Screen ownership rule: several screens (Admin Portal tabs, the pricing/event
 * wizards) set a hash-scoped route (`/admin-portal#pricing/plan`) via
 * replaceState. React Router can't see that hash, so its own route push for the
 * SAME pathname is hashless (`/admin-portal`) and would otherwise downgrade the
 * panel from the step doc back to the bare-tab doc. So we ignore a hashless push
 * when the buffer already holds a hash for that same pathname. A push to a
 * DIFFERENT pathname (real navigation) always wins, as does any hash-scoped push.
 *
 * @param {string} route - pathname + hash, e.g. `/admin-portal#pricing/plan`
 */
export function setHelpRoute(route) {
  if (typeof window === 'undefined' || !route) return;

  const current = window[BUFFER_KEY];
  if (
    current &&
    !hasHash(route) &&
    hasHash(current) &&
    pathOf(current) === pathOf(route)
  ) {
    // Don't let a hashless router push stomp a screen-owned hash on the same page.
    return;
  }

  window[BUFFER_KEY] = route;
  const help = window.tabsHelp;
  if (help && typeof help.setRoute === 'function') {
    help.setRoute(route);
  }
}

/**
 * Return the buffered route (or null). Used by the TabsHelp wrapper to replay
 * the app's intended route once the SDK boots, so a hash written via
 * replaceState before the SDK was ready still resolves the correct doc.
 */
export function getPendingHelpRoute() {
  if (typeof window === 'undefined') return null;
  return window[BUFFER_KEY] || null;
}
