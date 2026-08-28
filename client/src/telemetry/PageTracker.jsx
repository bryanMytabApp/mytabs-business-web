import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { screenView } from "./telemetry";

/**
 * Emits a `screen_view` usage event on every client-side route change.
 *
 * Mounted inside the RouterProvider tree (via AppLayout) so `useLocation()`
 * observes each navigation. The screen name is the URL pathname (query strings
 * omitted to avoid leaking ids/PII). Safe no-op when telemetry is disabled.
 *
 * Renders nothing.
 */
export default function PageTracker() {
  const { pathname } = useLocation();
  const lastPath = useRef(null);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    lastPath.current = pathname;
    screenView(pathname);
  }, [pathname]);

  return null;
}
