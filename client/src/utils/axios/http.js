import axios from "axios";
import configJSON from "../../config.json"
import { CognitoUser, CognitoRefreshToken, CognitoUserPool } from 'amazon-cognito-identity-js';
import { isTokenExpired, endSessionAndRedirect } from "../auth/session";
import { apiLatency } from "../../telemetry/telemetry";
const config = configJSON;

const CUP = new CognitoUserPool(config.userPoolData)

const axiosConfig = {
  baseURL: config.backendUrl,
  withCredentials: false,
};

const refreshAccessToken = async () => {
  try {
    let ref = localStorage.getItem("refToken");
    if (!ref) {
      console.error('No refresh token found');
      return "";
    }
    
    var refreshToken;
    try {
      refreshToken = JSON.parse(ref);
    } catch (e) {
      // Token stored as raw string (not JSON-stringified)
      refreshToken = ref;
    }
    var email = localStorage.getItem("username");
    
    if (!email) {
      console.error('No username found');
      return "";
    }
    
    var cognitoRefreshToken = new CognitoRefreshToken({ RefreshToken: refreshToken });

    const user = new CognitoUser({
      Username: email,
      Pool: CUP,
    });

    const newToken = await new Promise((resolve) => {
      user.refreshSession(cognitoRefreshToken, async (error, session) => {
        if (error) {
          console.error('Error refreshing session:', error);
          resolve("");
        } else {
          const newRefreshToken = session.getRefreshToken().getToken();
          localStorage.setItem("refToken", JSON.stringify(newRefreshToken));

          const updatedToken = session.getIdToken().getJwtToken();
          localStorage.setItem("idToken", updatedToken);
          resolve(updatedToken);
        }
      });
    });

    return newToken;
  } catch (error) {
    console.error('Error in refreshAccessToken:', error);
    return "";
  }
};

const http = axios.create(axiosConfig);

http.interceptors.request.use( async function ( config ) {
  // Use accessToken if explicitly requested, otherwise use idToken
  if (config.useAccessToken) {
    let accessToken = localStorage.getItem("accessToken");
    console.log('🔐 Using AccessToken for request:', config.url, 'token present:', !!accessToken);
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  } else {
    let token = localStorage.getItem("idToken");
    if ( token ) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  // Attach the selected business context header on all requests when a business is selected.
  // Allow individual requests to opt out via config.skipBusinessContext = true
  const selectedBizId = sessionStorage.getItem("selectedBusinessId");
  if (selectedBizId && !config.skipBusinessContext) {
    config.headers["X-Business-Id"] = selectedBizId;
  }
  // Telemetry: stamp request start for an API-latency sample.
  config.metadata = { startTime: Date.now() };
  return config;
}, function (error) {
  return Promise.reject(error);
});

/**
 * Decides whether a failed request means "the session is dead".
 *
 * - 401 is always an auth failure.
 * - 403 is ambiguous: API Gateway authorizers return it for expired/invalid
 *   tokens, but the app also returns it for legitimate permission denials.
 *   Only treat it as a session failure when the local token is actually stale.
 * - No response at all (CORS-blocked gateway 4xx, offline) is only a session
 *   failure when the local token is stale — otherwise it is a network error.
 */
const isSessionFailure = (error) => {
	const status = error.response?.status;
	if (status === 401) return true;

	const localTokenStale = isTokenExpired(localStorage.getItem("idToken"));
	if (status === 403) return localTokenStale;
	if (!error.response) return localTokenStale;
	return false;
};

http.interceptors.response.use(
	(response) => {
		// Dispatch session-activity event on successful API responses
		window.dispatchEvent(new CustomEvent('session-activity'));
		try {
			const start = response.config && response.config.metadata && response.config.metadata.startTime;
			if (start) apiLatency({ method: (response.config.method || 'get').toUpperCase(), path: response.config.url, status: response.status, durationMs: Date.now() - start });
		} catch (_) { /* telemetry must never break requests */ }
		return response;
	},
	async (error) => {
		const originalRequest = error.config || {};
		try {
			const start = originalRequest.metadata && originalRequest.metadata.startTime;
			if (start) apiLatency({ method: (originalRequest.method || 'get').toUpperCase(), path: originalRequest.url, status: error.response && error.response.status, durationMs: Date.now() - start });
		} catch (_) { /* telemetry must never break requests */ }

		if (!isSessionFailure(error)) {
			return Promise.reject(error);
		}

		if (!originalRequest._retry) {
			originalRequest._retry = true;
			const access_token = await refreshAccessToken();

			if (access_token) {
				axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
				originalRequest.headers = originalRequest.headers || {};
				originalRequest.headers.Authorization = `Bearer ${access_token}`;
				return http(originalRequest);
			}
		}

		// Refresh failed or already retried: clear every auth artifact and send
		// the user to login with a returnUrl so they land back on this page.
		endSessionAndRedirect();
		return Promise.reject(error);
	});


export { refreshAccessToken };
export default http;