import http from "../utils/axios/http";

/**
 * Google OAuth Web Client ID for Google Identity Services (popup mode).
 * This is the same Web-type client ID used across platforms.
 */
export const GOOGLE_CLIENT_ID =
  "841306082678-161q4vc6jim9n03gqtnr55dl6lm0n8dd.apps.googleusercontent.com";

/**
 * Apple Services ID for Sign in with Apple on web (popup mode).
 * This must match the Services ID configured in Apple Developer Console
 * with the web domain and return URL registered.
 */
export const APPLE_CLIENT_ID = "com.keeptabs.web.signin";

/**
 * Facebook App ID for Facebook Login on web (popup mode).
 * This must match the App ID configured in Meta Developer Console.
 */
export const FACEBOOK_APP_ID = "837900282454875";

/**
 * The redirect URI that Apple will use after authentication.
 * Must be registered in Apple Developer Console under the Services ID.
 */
const APPLE_REDIRECT_URI = "https://keeptabs.app/auth/apple/callback";

/**
 * Signs in or signs up a user with Google via the web portal.
 * Takes the credential (id_token) from the Google Identity Services response
 * and sends it to the backend for verification and Cognito authentication.
 *
 * @param {string} credential - The id_token JWT from Google Identity Services callback
 * @returns {Promise<object>} The auth response: { IdToken, AccessToken, RefreshToken, userId, user, isNewUser }
 */
export const signInWithGoogle = async (credential) => {
  try {
    const response = await http.post("authWeb/social-auth", {
      provider: "google",
      idToken: credential,
    });

    const data = response.data;

    // Store Cognito tokens in localStorage matching existing web auth pattern
    if (data.IdToken) {
      localStorage.setItem("idToken", data.IdToken);
    }
    if (data.AccessToken) {
      localStorage.setItem("accessToken", data.AccessToken);
    }
    if (data.RefreshToken) {
      localStorage.setItem("refToken", data.RefreshToken);
    }
    if (data.user?.email) {
      localStorage.setItem("username", data.user.email);
    }

    return data;
  } catch (error) {
    // Re-throw with useful context for the caller
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      "Google sign-in failed. Please try again.";
    const enhanced = new Error(message);
    enhanced.status = error.response?.status;
    enhanced.originalError = error;
    throw enhanced;
  }
};

/**
 * Loads the Apple Sign-In JS SDK dynamically if not already present.
 * The SDK is loaded from Apple's CDN and provides the AppleID.auth API.
 *
 * @returns {Promise<void>} Resolves when the SDK is ready
 */
const loadAppleSDK = () => {
  return new Promise((resolve, reject) => {
    // If already loaded, resolve immediately
    if (window.AppleID) {
      resolve();
      return;
    }

    // Check if script tag already exists (loading in progress)
    const existing = document.querySelector(
      'script[src="https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Apple Sign-In SDK."))
      );
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Apple Sign-In SDK."));
    document.head.appendChild(script);
  });
};

/**
 * Signs in or signs up a user with Apple via the web portal (popup mode).
 * Loads the Apple JS SDK, opens the Apple Sign-In popup, extracts the id_token,
 * and sends it to the backend for verification and Cognito authentication.
 *
 * @returns {Promise<object>} The auth response: { IdToken, AccessToken, RefreshToken, userId, user, isNewUser }
 */
export const signInWithApple = async () => {
  try {
    // Load Apple JS SDK
    await loadAppleSDK();

    // Configure Apple Sign-In
    window.AppleID.auth.init({
      clientId: APPLE_CLIENT_ID,
      scope: "name email",
      redirectURI: APPLE_REDIRECT_URI,
      usePopup: true,
    });

    // Trigger popup and await response
    const appleResponse = await window.AppleID.auth.signIn();

    // Extract authorization data from Apple's response
    const { authorization, user } = appleResponse;
    const idToken = authorization?.id_token;

    if (!idToken) {
      throw new Error("No identity token received from Apple.");
    }

    // Build request payload — include user info if provided (first sign-in only)
    const payload = {
      provider: "apple",
      idToken,
    };

    // Apple only provides user info (name, email) on the FIRST authorization.
    // We pass it to the backend so it can store it for new account creation.
    if (user) {
      payload.appleUser = authorization.user || undefined;
      if (user.name) {
        payload.fullName = {
          givenName: user.name.firstName || undefined,
          familyName: user.name.lastName || undefined,
        };
      }
    }

    // Send to backend for verification and Cognito auth
    const response = await http.post("authWeb/social-auth", payload);
    const data = response.data;

    // Store Cognito tokens in localStorage matching existing web auth pattern
    if (data.IdToken) {
      localStorage.setItem("idToken", data.IdToken);
    }
    if (data.AccessToken) {
      localStorage.setItem("accessToken", data.AccessToken);
    }
    if (data.RefreshToken) {
      localStorage.setItem("refToken", data.RefreshToken);
    }
    if (data.user?.email) {
      localStorage.setItem("username", data.user.email);
    }

    return data;
  } catch (error) {
    // Apple popup cancellation — user closed the popup without completing
    if (
      error.type === "popup_closed_by_user" ||
      error.error === "popup_closed_by_user"
    ) {
      const cancelled = new Error("Apple sign-in was cancelled.");
      cancelled.code = "CANCELLED";
      cancelled.status = 0;
      throw cancelled;
    }

    // Backend or network error
    if (error.response) {
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Apple sign-in failed. Please try again.";
      const enhanced = new Error(message);
      enhanced.status = error.response?.status;
      enhanced.originalError = error;
      throw enhanced;
    }

    // SDK load failure or other error
    const enhanced = new Error(
      error.message || "Apple sign-in failed. Please try again."
    );
    enhanced.originalError = error;
    throw enhanced;
  }
};


/**
 * Loads the Facebook JS SDK dynamically if not already present.
 * The SDK is loaded from Facebook's CDN and provides the FB global object.
 *
 * @returns {Promise<void>} Resolves when the SDK is initialized and ready
 */
const loadFacebookSDK = () => {
  return new Promise((resolve, reject) => {
    // If already loaded and initialized, resolve immediately
    if (window.FB) {
      resolve();
      return;
    }

    // Check if script tag already exists (loading in progress)
    const existing = document.querySelector(
      'script[src="https://connect.facebook.net/en_US/sdk.js"]'
    );
    if (existing) {
      existing.addEventListener("load", () => {
        window.FB.init({
          appId: FACEBOOK_APP_ID,
          cookie: true,
          xfbml: false,
          version: "v19.0",
        });
        resolve();
      });
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Facebook SDK."))
      );
      return;
    }

    // Set up the async init callback before loading the script
    window.fbAsyncInit = () => {
      window.FB.init({
        appId: FACEBOOK_APP_ID,
        cookie: true,
        xfbml: false,
        version: "v19.0",
      });
      resolve();
    };

    const script = document.createElement("script");
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      // fbAsyncInit will be called by the SDK once it's ready
      // If FB is already available (rare race), init manually
      if (window.FB && !window.fbAsyncInit) {
        window.FB.init({
          appId: FACEBOOK_APP_ID,
          cookie: true,
          xfbml: false,
          version: "v19.0",
        });
        resolve();
      }
    };
    script.onerror = () =>
      reject(new Error("Failed to load Facebook SDK."));
    document.head.appendChild(script);
  });
};

/**
 * Signs in or signs up a user with Facebook via the web portal (popup mode).
 * Loads the Facebook JS SDK, opens the Facebook Login popup, extracts the access token,
 * and sends it to the backend for verification and Cognito authentication.
 *
 * Facebook's access token serves as the identity proof — the backend verifies it
 * via the Graph API debug_token endpoint.
 *
 * @returns {Promise<object>} The auth response: { IdToken, AccessToken, RefreshToken, userId, user, isNewUser }
 */
export const signInWithFacebook = async () => {
  try {
    // Load Facebook JS SDK
    await loadFacebookSDK();

    // Trigger Facebook Login popup and await response
    const fbResponse = await new Promise((resolve, reject) => {
      window.FB.login(
        (response) => {
          if (response.status === "connected") {
            resolve(response);
          } else if (
            response.status === "not_authorized" ||
            response.status === "unknown"
          ) {
            // User closed popup or declined permissions
            const cancelled = new Error("Facebook sign-in was cancelled.");
            cancelled.code = "CANCELLED";
            cancelled.status = 0;
            reject(cancelled);
          } else {
            reject(new Error("Facebook login failed. Please try again."));
          }
        },
        { scope: "email,public_profile" }
      );
    });

    // Extract the access token from Facebook's response
    const accessToken = fbResponse.authResponse?.accessToken;

    if (!accessToken) {
      throw new Error("No access token received from Facebook.");
    }

    // Send to backend for verification and Cognito auth
    // Facebook's access token is sent as idToken — the backend verifies it via Graph API
    const response = await http.post("authWeb/social-auth", {
      provider: "facebook",
      idToken: accessToken,
    });

    const data = response.data;

    // Store Cognito tokens in localStorage matching existing web auth pattern
    if (data.IdToken) {
      localStorage.setItem("idToken", data.IdToken);
    }
    if (data.AccessToken) {
      localStorage.setItem("accessToken", data.AccessToken);
    }
    if (data.RefreshToken) {
      localStorage.setItem("refToken", data.RefreshToken);
    }
    if (data.user?.email) {
      localStorage.setItem("username", data.user.email);
    }

    return data;
  } catch (error) {
    // User cancelled — re-throw as-is with the CANCELLED code
    if (error.code === "CANCELLED") {
      throw error;
    }

    // Backend or network error
    if (error.response) {
      const message =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Facebook sign-in failed. Please try again.";
      const enhanced = new Error(message);
      enhanced.status = error.response?.status;
      enhanced.originalError = error;
      throw enhanced;
    }

    // SDK load failure or other error
    const enhanced = new Error(
      error.message || "Facebook sign-in failed. Please try again."
    );
    enhanced.originalError = error;
    throw enhanced;
  }
};
