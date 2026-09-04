import { useState, useEffect } from "react";

/**
 * The media query used to detect the user's reduced-motion preference.
 * @type {string}
 */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Safely resolves the current value of the reduced-motion media query.
 *
 * Guards against environments where `window` or `window.matchMedia` are not
 * available (SSR, some test runners) by returning `false` (motion allowed).
 *
 * @returns {boolean} `true` when the user prefers reduced motion.
 */
const getInitialPreference = () => {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
};

/**
 * React hook that reports whether the user has requested reduced motion via the
 * `(prefers-reduced-motion: reduce)` media query.
 *
 * It subscribes to `matchMedia` change events so the returned value stays in
 * sync if the OS/browser setting changes while the page is open, and removes the
 * listener on unmount. When `matchMedia` is unavailable (SSR/test safety) the
 * hook defaults to `false` so animations are allowed.
 *
 * Used to gate non-essential animations such as the Hero float animation and
 * smooth-scroll anchor navigation (Requirements 2.7, 2.8, 15.4, 18.2).
 *
 * @returns {boolean} `true` when reduced motion is preferred, otherwise `false`.
 */
const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(getInitialPreference);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQueryList = window.matchMedia(REDUCED_MOTION_QUERY);

    // Sync in case the preference changed between initial render and effect.
    setPrefersReducedMotion(mediaQueryList.matches);

    const handleChange = (event) => {
      setPrefersReducedMotion(event.matches);
    };

    // Modern browsers expose addEventListener; older Safari uses addListener.
    if (typeof mediaQueryList.addEventListener === "function") {
      mediaQueryList.addEventListener("change", handleChange);
      return () => {
        mediaQueryList.removeEventListener("change", handleChange);
      };
    }

    mediaQueryList.addListener(handleChange);
    return () => {
      mediaQueryList.removeListener(handleChange);
    };
  }, []);

  return prefersReducedMotion;
};

export default useReducedMotion;
export { REDUCED_MOTION_QUERY };
