import { getCookie } from './Tools.ts';
import { getUserById } from '../services/userService';

// Allowed user IDs for Admin Portal access
const ADMIN_PORTAL_ALLOWED_USER_IDS: string[] = [
  'c2481a85-a3d9-4f7d-bc5a-358b1b1c3d22', // Urban HTX
  '73aa6a3c-7bf7-4359-94cd-d99905a5459f'  // Tabs Event Houston
];

/**
 * Parse JWT token and return full payload
 * @param {string} token - JWT token
 * @returns {any} - Full JWT payload
 */
const parseJwtFull = (token: string): any => {
  const base64Url = token.split(".")[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split("")
      .map(function (c) {
        return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
      })
      .join("")
  );
  return JSON.parse(jsonPayload);
};

/**
 * Checks if the current user has access to the Admin Portal
 * @returns {Promise<boolean>} true if user has access, false otherwise
 */
export const hasAdminPortalAccess = async (): Promise<boolean> => {
  try {
    // Get token from localStorage or cookie
    let token = localStorage.getItem('idToken');
    if (!token) {
      token = getCookie('token');
    }
    
    if (!token) {
      return false;
    }

    // Extract user ID from JWT token to get the custom:user_id
    const userPayload = parseJwtFull(token);
    const customUserId = userPayload["custom:user_id"];
    
    if (!customUserId) {
      return false;
    }

    // Fetch user data from API
    const response = await getUserById(customUserId);
    const userData = response.data;
    
    if (!userData || !userData._id) {
      return false;
    }

    // Check if user ID is in the allowed list
    return ADMIN_PORTAL_ALLOWED_USER_IDS.includes(userData._id);
  } catch (error) {
    console.error('Error checking admin portal access:', error);
    return false;
  }
};

/**
 * Gets the current user data from the API
 * @returns {Promise<any | null>} user data or null if not found
 */
export const getCurrentUserData = async (): Promise<any | null> => {
  try {
    let token = localStorage.getItem('idToken');
    if (!token) {
      token = getCookie('token');
    }
    
    if (!token) {
      return null;
    }

    // Extract user ID from JWT token
    const userPayload = parseJwtFull(token);
    const customUserId = userPayload["custom:user_id"];
    
    if (!customUserId) {
      return null;
    }

    // Fetch user data from API
    const response = await getUserById(customUserId);
    return response.data;
  } catch (error) {
    console.error('Error getting current user data:', error);
    return null;
  }
};
