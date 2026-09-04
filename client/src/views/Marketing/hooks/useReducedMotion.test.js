import { renderHook, act } from "@testing-library/react";

import useReducedMotion, { REDUCED_MOTION_QUERY } from "./useReducedMotion";

/**
 * Builds a fake MediaQueryList backed by the modern addEventListener /
 * removeEventListener API. Returns the object plus a `fire(matches)` helper
 * that dispatches a synthetic "change" event to all registered listeners.
 */
const createModernMatchMedia = (initialMatches) => {
  const listeners = new Set();
  const mql = {
    matches: initialMatches,
    media: REDUCED_MOTION_QUERY,
    addEventListener: jest.fn((event, cb) => {
      if (event === "change") listeners.add(cb);
    }),
    removeEventListener: jest.fn((event, cb) => {
      if (event === "change") listeners.delete(cb);
    }),
  };
  const fire = (matches) => {
    mql.matches = matches;
    listeners.forEach((cb) => cb({ matches }));
  };
  return { mql, fire, listeners };
};

/**
 * Builds a fake MediaQueryList backed by the legacy addListener /
 * removeListener API (older Safari), without addEventListener.
 */
const createLegacyMatchMedia = (initialMatches) => {
  const listeners = new Set();
  const mql = {
    matches: initialMatches,
    media: REDUCED_MOTION_QUERY,
    addListener: jest.fn((cb) => listeners.add(cb)),
    removeListener: jest.fn((cb) => listeners.delete(cb)),
  };
  const fire = (matches) => {
    mql.matches = matches;
    listeners.forEach((cb) => cb({ matches }));
  };
  return { mql, fire, listeners };
};

describe("useReducedMotion", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    // Restore whatever matchMedia was before each test mutated it.
    window.matchMedia = originalMatchMedia;
    jest.clearAllMocks();
  });

  it("exports the reduced-motion media query string", () => {
    expect(REDUCED_MOTION_QUERY).toBe("(prefers-reduced-motion: reduce)");
  });

  it("returns false when the media query does not match", () => {
    const { mql } = createModernMatchMedia(false);
    window.matchMedia = jest.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());

    expect(window.matchMedia).toHaveBeenCalledWith(REDUCED_MOTION_QUERY);
    expect(result.current).toBe(false);
  });

  it("returns true when the media query matches on mount", () => {
    const { mql } = createModernMatchMedia(true);
    window.matchMedia = jest.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });

  it("updates to true when a change event fires (addEventListener)", () => {
    const { mql, fire } = createModernMatchMedia(false);
    window.matchMedia = jest.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      fire(true);
    });

    expect(result.current).toBe(true);
    expect(mql.addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("updates back to false when a subsequent change event fires", () => {
    const { mql, fire } = createModernMatchMedia(true);
    window.matchMedia = jest.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);

    act(() => {
      fire(false);
    });

    expect(result.current).toBe(false);
  });

  it("supports the legacy addListener API and updates on change", () => {
    const { mql, fire } = createLegacyMatchMedia(false);
    window.matchMedia = jest.fn().mockReturnValue(mql);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    expect(mql.addListener).toHaveBeenCalledWith(expect.any(Function));

    act(() => {
      fire(true);
    });

    expect(result.current).toBe(true);
  });

  it("removes the modern listener on unmount", () => {
    const { mql, listeners } = createModernMatchMedia(false);
    window.matchMedia = jest.fn().mockReturnValue(mql);

    const { unmount } = renderHook(() => useReducedMotion());
    expect(listeners.size).toBe(1);

    unmount();

    expect(mql.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(listeners.size).toBe(0);
  });

  it("removes the legacy listener on unmount", () => {
    const { mql, listeners } = createLegacyMatchMedia(false);
    window.matchMedia = jest.fn().mockReturnValue(mql);

    const { unmount } = renderHook(() => useReducedMotion());
    expect(listeners.size).toBe(1);

    unmount();

    expect(mql.removeListener).toHaveBeenCalledWith(expect.any(Function));
    expect(listeners.size).toBe(0);
  });

  it("defaults to false when matchMedia is unavailable", () => {
    // Simulate an environment (SSR / bare test runner) without matchMedia.
    window.matchMedia = undefined;

    const { result } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
  });
});
