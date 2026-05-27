/**
 * Extract user ID from JWT token stored in localStorage
 * @returns {string|null} User ID or null if not found
 */
export const getCurrentUserId = () => {
  try {
    const idToken = localStorage.getItem('idToken');
    if (!idToken) {
      return null;
    }

    // Parse JWT token
    const base64Url = idToken.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    const tokenPayload = JSON.parse(jsonPayload);
    
    // Extract userId - try custom:user_id first, then sub (Cognito user ID), then email
    const userId = tokenPayload['custom:user_id'] || tokenPayload.sub || tokenPayload.email;
    
    console.log('🔑 Extracted userId from token:', userId);
    return userId;
  } catch (error) {
    console.error('Error extracting user ID from token:', error);
    return null;
  }
};

/**
 * Super admin user IDs (from database)
 */
const SUPER_ADMIN_USERNAMES = ['urbanhtx', 'findhouston'];

/**
 * Get username from JWT token
 * @returns {string|null} Username or null if not found
 */
export const getCurrentUsername = () => {
  try {
    const idToken = localStorage.getItem('idToken');
    if (!idToken) {
      return null;
    }

    const base64Url = idToken.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );
    const tokenPayload = JSON.parse(jsonPayload);
    
    // Extract username from preferred_username or cognito:username
    const username = tokenPayload['preferred_username'] || tokenPayload['cognito:username'];
    
    return username;
  } catch (error) {
    console.error('Error extracting username from token:', error);
    return null;
  }
};

/**
 * Check if current user is a super admin
 * @returns {boolean} True if user is super admin, false otherwise
 */
export const isSuperAdmin = () => {
  const username = getCurrentUsername();
  
  if (!username) {
    return false;
  }
  
  const isAdmin = SUPER_ADMIN_USERNAMES.includes(username.toLowerCase());
  console.log('👑 Super admin check for user:', username, '→', isAdmin);
  
  return isAdmin;
};

/**
 * Check if current user has access to My Tickets feature
 * @returns {boolean} True if user has access, false otherwise
 */
export const hasMyTicketsAccess = () => {
  const currentUserId = getCurrentUserId();
  
  console.log('🎫 Checking My Tickets access for user:', currentUserId);
  
  // Allow access for all authenticated users
  return currentUserId !== null;
};

/**
 * Validate return URL domain to prevent open redirect attacks
 */
export function isValidReturnUrl(returnUrl) {
  try {
    const url = new URL(returnUrl, window.location.origin);
    const currentOrigin = new URL(window.location.href).origin;
    
    // Allow same domain and subdomains
    return url.origin === currentOrigin || url.hostname.endsWith('.keeptabs.app');
  } catch (error) {
    console.error('Invalid return URL:', error);
    return false;
  }
}

/**
 * Build authenticated return URL by appending token and userId
 */
export function buildAuthenticatedReturnUrl(returnUrl, token, userId) {
  const separator = returnUrl.includes('?') ? '&' : '?';
  return `${returnUrl}${separator}token=${encodeURIComponent(token)}&userId=${encodeURIComponent(userId)}`;
}