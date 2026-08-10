import axios from "axios";
import configJSON from "../../config.json"
import { CognitoUser, CognitoRefreshToken, CognitoUserPool } from 'amazon-cognito-identity-js';
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
  return config;
}, function (error) {
  return Promise.reject(error);
});

http.interceptors.response.use(
	(response) => {
		// Dispatch session-activity event on successful API responses
		window.dispatchEvent(new CustomEvent('session-activity'));
		return response;
	},
	async (error) => {
		const originalRequest = error.config;
		if (error.response?.status === 401 && !originalRequest._retry) {
			originalRequest._retry = true;
			const access_token = await refreshAccessToken();
			
			if (!access_token) {
				// Token refresh failed, clear storage and redirect
				localStorage.removeItem("idToken");
				localStorage.removeItem("refToken");
				localStorage.removeItem("username");
				window.location.href = "/login";
				return Promise.reject(error);
			}
			
			axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
			originalRequest.headers.Authorization = `Bearer ${access_token}`;
			return http(originalRequest);
		} else if (error.response?.status === 401) {
			// Second 401 after retry, clear storage and redirect
			localStorage.removeItem("idToken");
			localStorage.removeItem("refToken");
			localStorage.removeItem("username");
			window.location.href = "/login";
			return Promise.reject(error);
		}
		return Promise.reject(error);
	});


export { refreshAccessToken };
export default http;