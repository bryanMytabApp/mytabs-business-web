/**
 * Session Timeout Management Hook
 *
 * Manages session timeouts based on Cognito ID token lifetime.
 * Includes inactivity timer, absolute timer, warning countdown,
 * throttled token refresh, and activity detection.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { refreshAccessToken } from '../utils/axios/http';

// Session timeout constants
export const SESSION_CONSTANTS = {
  WARNING_DURATION_MS: 120000,       // 2 minutes before expiry (warning countdown)
  WARNING_UPDATE_INTERVAL_MS: 1000,  // Progress bar update frequency (1 second)
  REFRESH_THROTTLE_MS: 30000,        // Minimum 30s between refresh calls
  ACTIVITY_EVENT_NAME: 'session-activity', // Custom event name for activity detection
};

/**
 * Decodes a JWT token string and returns the payload object.
 * Returns null for malformed or invalid tokens.
 *
 * @param {string} token - The JWT token string to decode
 * @returns {object|null} The decoded payload with iat, exp, and other claims, or null if invalid
 */
export const decodeJWT = (token) => {
  if (!token || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );

    const payload = JSON.parse(jsonPayload);

    // Validate that the payload is an object
    if (typeof payload !== 'object' || payload === null) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
};

/**
 * useSessionTimeout hook
 *
 * Manages session timeout logic including:
 * - Inactivity timer (resets on qualifying activity)
 * - Absolute timer (never resets except on token refresh)
 * - Warning state with countdown
 * - Token refresh (throttled)
 * - Activity detection (route changes, API calls, page reload, explicit resets)
 *
 * @returns {object} Session timeout state and handlers
 */
const useSessionTimeout = () => {
  const { WARNING_DURATION_MS, WARNING_UPDATE_INTERVAL_MS, REFRESH_THROTTLE_MS, ACTIVITY_EVENT_NAME } = SESSION_CONSTANTS;
  const warningDuration = WARNING_DURATION_MS / 1000; // 120 seconds

  // State
  const [isWarningActive, setIsWarningActive] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(warningDuration);

  // Refs for timers
  const inactivityTimerRef = useRef(null);
  const absoluteTimerRef = useRef(null);
  const countdownIntervalRef = useRef(null);

  // Refs for computed values
  const inactivityTimeoutMsRef = useRef(null);
  const absoluteExpiryTimeRef = useRef(null);
  const lastRefreshTimeRef = useRef(0);

  // Track if hook is mounted
  const isMountedRef = useRef(true);

  // Location for route change detection
  const location = useLocation();

  // --- Session Termination (Task 2.7) ---
  const terminateSession = useCallback(() => {
    // Clear all timers
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (absoluteTimerRef.current) {
      clearTimeout(absoluteTimerRef.current);
      absoluteTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // Clear auth tokens from localStorage
    localStorage.removeItem('idToken');
    localStorage.removeItem('refToken');
    localStorage.removeItem('username');

    // Redirect to login
    window.location.href = '/login';
  }, []);

  // --- Clear All Timers (for manual logout integration) ---
  const clearAllTimers = useCallback(() => {
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    if (absoluteTimerRef.current) {
      clearTimeout(absoluteTimerRef.current);
      absoluteTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // --- Start Warning Countdown (Task 2.3) ---
  const startWarningCountdown = useCallback(() => {
    setIsWarningActive(true);
    setRemainingSeconds(warningDuration);

    // Clear any existing countdown
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    let secondsLeft = warningDuration;

    countdownIntervalRef.current = setInterval(() => {
      secondsLeft -= 1;

      if (!isMountedRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        return;
      }

      setRemainingSeconds(secondsLeft);

      if (secondsLeft <= 0) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        terminateSession();
      }
    }, WARNING_UPDATE_INTERVAL_MS);
  }, [warningDuration, WARNING_UPDATE_INTERVAL_MS, terminateSession]);

  // --- Start Inactivity Timer (Task 2.3) ---
  const startInactivityTimer = useCallback(() => {
    // Clear existing inactivity timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    const timeoutMs = inactivityTimeoutMsRef.current;
    if (!timeoutMs || timeoutMs <= 0) return;

    // Time until warning = total timeout - warning duration
    const timeUntilWarning = timeoutMs - WARNING_DURATION_MS;

    if (timeUntilWarning <= 0) {
      // If TTL is less than or equal to warning duration, show warning immediately
      startWarningCountdown();
      return;
    }

    inactivityTimerRef.current = setTimeout(() => {
      startWarningCountdown();
    }, timeUntilWarning);
  }, [WARNING_DURATION_MS, startWarningCountdown]);

  // --- Start Absolute Timer (Task 2.5) ---
  const startAbsoluteTimer = useCallback(() => {
    // Clear existing absolute timer
    if (absoluteTimerRef.current) {
      clearTimeout(absoluteTimerRef.current);
      absoluteTimerRef.current = null;
    }

    const expiryTime = absoluteExpiryTimeRef.current;
    if (!expiryTime) return;

    const timeUntilExpiry = expiryTime - Date.now();

    if (timeUntilExpiry <= 0) {
      // Already expired
      terminateSession();
      return;
    }

    absoluteTimerRef.current = setTimeout(() => {
      terminateSession();
    }, timeUntilExpiry);
  }, [terminateSession]);

  // --- Initialize Timers from Token (Task 2.1) ---
  const initializeTimers = useCallback(() => {
    const idToken = localStorage.getItem('idToken');
    if (!idToken) return;

    const payload = decodeJWT(idToken);
    if (!payload || !payload.iat || !payload.exp) return;

    // Calculate inactivity timeout: (exp - iat) * 1000 ms
    const inactivityTimeoutMs = (payload.exp - payload.iat) * 1000;
    inactivityTimeoutMsRef.current = inactivityTimeoutMs;

    // Calculate absolute expiry time: exp * 1000 (epoch ms)
    const absoluteExpiryTime = payload.exp * 1000;
    absoluteExpiryTimeRef.current = absoluteExpiryTime;

    // Start both timers
    startInactivityTimer();
    startAbsoluteTimer();
  }, [startInactivityTimer, startAbsoluteTimer]);

  // --- Throttled Token Refresh (Task 3.4) ---
  const refreshToken = useCallback(async () => {
    const now = Date.now();

    // Throttle: skip if less than REFRESH_THROTTLE_MS since last refresh
    if (now - lastRefreshTimeRef.current < REFRESH_THROTTLE_MS) {
      return true; // Treat as success (throttled, no action needed)
    }

    lastRefreshTimeRef.current = now;

    try {
      const newToken = await refreshAccessToken();

      if (!newToken) {
        // Refresh failed
        terminateSession();
        return false;
      }

      // On success: read new idToken, decode, recalculate timers
      const idToken = localStorage.getItem('idToken');
      if (!idToken) {
        terminateSession();
        return false;
      }

      const payload = decodeJWT(idToken);
      if (!payload || !payload.iat || !payload.exp) {
        terminateSession();
        return false;
      }

      // Recalculate both timers
      inactivityTimeoutMsRef.current = (payload.exp - payload.iat) * 1000;
      absoluteExpiryTimeRef.current = payload.exp * 1000;

      startInactivityTimer();
      startAbsoluteTimer();

      return true;
    } catch (error) {
      terminateSession();
      return false;
    }
  }, [REFRESH_THROTTLE_MS, terminateSession, startInactivityTimer, startAbsoluteTimer]);

  // --- Reset Inactivity Timer (Task 3.1) ---
  const resetInactivityTimer = useCallback(() => {
    // Only reset if we have a valid timeout configured
    if (!inactivityTimeoutMsRef.current) return;

    // If warning is active, don't reset (user must interact with popup)
    if (isWarningActive) return;

    startInactivityTimer();
  }, [isWarningActive, startInactivityTimer]);

  // --- Handle Stay On (Task 3.7) ---
  const handleStayOn = useCallback(async () => {
    const success = await refreshToken();

    if (success) {
      // Dismiss warning
      setIsWarningActive(false);
      setRemainingSeconds(warningDuration);

      // Clear countdown interval
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }
    // If refresh failed, terminateSession is already called inside refreshToken
  }, [refreshToken, warningDuration]);

  // --- Handle Logout (Task 3.7) ---
  const handleLogout = useCallback(() => {
    terminateSession();
  }, [terminateSession]);

  // --- Mount: Initialize timers and handle page reload (Tasks 2.1, 3.1) ---
  useEffect(() => {
    isMountedRef.current = true;

    // Check for page reload flag
    const wasReloaded = sessionStorage.getItem('session-page-reload');
    if (wasReloaded) {
      sessionStorage.removeItem('session-page-reload');
    }

    // Always initialize timers from the current token first
    initializeTimers();

    // If it was a reload and the token is close to expiry, attempt a refresh
    // (but don't terminate if it fails — the timers are already running)
    if (wasReloaded) {
      const idToken = localStorage.getItem('idToken');
      if (idToken) {
        const payload = decodeJWT(idToken);
        if (payload && payload.exp) {
          const timeUntilExpiry = (payload.exp * 1000) - Date.now();
          // Only refresh if less than 5 minutes remain
          if (timeUntilExpiry < 300000) {
            refreshAccessToken().then((newToken) => {
              if (newToken && isMountedRef.current) {
                // Recalculate timers with new token
                initializeTimers();
              }
            }).catch(() => {
              // Refresh failed on reload — don't terminate, timers are already set
            });
          }
        }
      }
    }

    // Set beforeunload flag for page reload detection
    const handleBeforeUnload = () => {
      sessionStorage.setItem('session-page-reload', 'true');
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearAllTimers();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Activity Detection: Route changes (Task 3.1) ---
  useEffect(() => {
    // Skip on initial mount (handled by initializeTimers)
    if (!inactivityTimeoutMsRef.current) return;

    resetInactivityTimer();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Activity Detection: Custom session-activity events (Task 3.1) ---
  useEffect(() => {
    const handleSessionActivity = () => {
      resetInactivityTimer();
    };

    window.addEventListener(ACTIVITY_EVENT_NAME, handleSessionActivity);

    return () => {
      window.removeEventListener(ACTIVITY_EVENT_NAME, handleSessionActivity);
    };
  }, [ACTIVITY_EVENT_NAME, resetInactivityTimer]);

  return {
    isWarningVisible: isWarningActive,
    remainingSeconds,
    warningDuration,
    handleStayOn,
    handleLogout,
    resetInactivityTimer,
    clearAllTimers,
  };
};

export default useSessionTimeout;
