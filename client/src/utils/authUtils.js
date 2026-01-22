/**
 * Authentication utilities for context-aware login redirect
 * Handles URL parameter extraction, token validation, and returnUrl management
 */

/**
 * Validate JWT token format
 * Checks if token matches JWT pattern (three dot-separated parts)
 */
export function validateTokenFormat(token) {
  if (!token) return false;
  
  const jwtPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
  return jwtPattern.test(token);
}

/**
 * Check if JWT token is expired
 * Decodes the token and compares exp claim with current timestamp
 */
export function isTokenExpired(token) {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    // Decode payload (add padding if needed)
    const payload = parts[1];
    const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
    const decoded = JSON.parse(atob(padded));

    // Check exp claim (in seconds)
    if (decoded.exp) {
      const expirationTime = decoded.exp * 1000; // Convert to milliseconds
      return Date.now() > expirationTime;
    }

    return false;
  } catch (error) {
    console.error('Error checking token expiration:', error);
    return true; // Treat as expired if we can't decode
  }
}

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
