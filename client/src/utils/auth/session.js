/**
 * Session utilities — single source of truth for "am I actually logged in?"
 *
 * Previously the app treated "an idToken string exists in localStorage" as
 * "logged in". An expired token therefore kept the user inside /admin, where
 * every API call failed and pages rendered empty states instead of signalling
 * that the session was gone.
 */

// Every key written during login/business selection. Partial clears are what
// left the app in a half-logged-in state.
const AUTH_LOCAL_KEYS = [
  "idToken",
  "accessToken",
  "refToken",
  "username",
  "userId",
  "sub",
  "sessionId",
];

const AUTH_SESSION_KEYS = ["selectedBusinessId"];

/**
 * Decodes a JWT payload. Returns null for missing or malformed tokens.
 * @param {string} token
 * @returns {object|null}
 */
export const decodeToken = (token) => {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload = JSON.parse(json);
    return typeof payload === "object" && payload !== null ? payload : null;
  } catch {
    return null;
  }
};

/**
 * True when the token is missing, unreadable, or past its `exp` claim.
 * A token without an `exp` claim is treated as expired — we cannot vouch for it.
 * @param {string} token
 * @param {number} [skewSeconds] Treat the token as expired this many seconds early.
 * @returns {boolean}
 */
export const isTokenExpired = (token, skewSeconds = 0) => {
  const payload = decodeToken(token);
  if (!payload || typeof payload.exp !== "number") return true;
  return Date.now() >= (payload.exp - skewSeconds) * 1000;
};

/**
 * True when the stored ID token exists and has not expired.
 * @returns {boolean}
 */
export const hasValidSession = () => {
  try {
    return !isTokenExpired(localStorage.getItem("idToken"));
  } catch {
    return false;
  }
};

/**
 * Removes every auth artifact. Safe to call repeatedly.
 */
export const clearSession = () => {
  try {
    AUTH_LOCAL_KEYS.forEach((key) => localStorage.removeItem(key));
    AUTH_SESSION_KEYS.forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Storage can throw in private-browsing modes; nothing else to do.
  }
};

/**
 * The login destination for an expired session.
 *
 * Deliberately does NOT use the `returnUrl` query param: the login flow
 * (useLogin / ChangePasswordView) appends the ID token to returnUrl as a query
 * string for cross-app handoff, which would leak a JWT into the URL bar and
 * browser history for an ordinary in-app re-login. Users land on /admin/home.
 *
 * @returns {string}
 */
export const buildLoginUrl = () => "/login";

/**
 * Clears the session and performs a hard redirect to the login screen.
 * No-ops the redirect when already on /login so we cannot create a loop.
 */
export const endSessionAndRedirect = () => {
  clearSession();
  if (window.location.pathname.startsWith("/login")) return;
  window.location.replace(buildLoginUrl());
};

export { AUTH_LOCAL_KEYS, AUTH_SESSION_KEYS };
