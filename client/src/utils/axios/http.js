import axios from "axios";
import configJSON from "../../config.json"
import { CognitoUser, CognitoRefreshToken, CognitoUserPool } from 'amazon-cognito-identity-js';
import { redirect} from "react-router-dom";
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
    
    var refreshToken = JSON.parse(ref);
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
  let token = localStorage.getItem("idToken");
  if ( token ) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, function (error) {
  return Promise.reject(error);
});

http.interceptors.response.use(
	(response) => {
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


export default http;