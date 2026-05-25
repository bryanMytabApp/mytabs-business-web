import http from "../utils/axios/http";
import { v4 as uuidv4 } from "uuid";

// Parse user agent to get device/browser info
const parseUserAgent = () => {
  const ua = navigator.userAgent;
  let browser = 'Unknown';
  let device = 'Unknown';

  if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';

  if (ua.includes('Windows')) device = 'Windows';
  else if (ua.includes('Macintosh')) device = 'Mac';
  else if (ua.includes('iPhone')) device = 'iPhone';
  else if (ua.includes('iPad')) device = 'iPad';
  else if (ua.includes('Android')) device = 'Android';
  else if (ua.includes('Linux')) device = 'Linux';

  return { browser, device };
};

// Get or create a session ID for this browser tab
const getSessionId = () => {
  let sessionId = localStorage.getItem('sessionId');
  if (!sessionId) {
    sessionId = uuidv4();
    localStorage.setItem('sessionId', sessionId);
  }
  return sessionId;
};

// Register a new session after login
export const registerSession = async (userId) => {
  try {
    const { browser, device } = parseUserAgent();
    const sessionId = getSessionId();

    const sessionData = {
      userId,
      session: {
        sessionId,
        browser,
        device,
        loginTime: new Date().toISOString(),
        lastActive: new Date().toISOString(),
      },
    };

    const response = await http.post("/user/session/register", sessionData);
    return response.data;
  } catch (error) {
    console.error("Error registering session:", error);
    // Don't block login if session tracking fails
  }
};

// Get all active sessions for a user
export const getUserSessions = async (userId) => {
  try {
    const response = await http.get(`/user/session/${userId}`);
    return response.data;
  } catch (error) {
    console.error("Error getting sessions:", error);
    return { sessions: [] };
  }
};

// Remove a specific session
export const revokeSession = async (userId, sessionId) => {
  try {
    const response = await http.post("/user/session/revoke", { userId, sessionId });
    return response.data;
  } catch (error) {
    console.error("Error revoking session:", error);
    throw error;
  }
};

// Update last active time for current session
export const heartbeat = async (userId) => {
  try {
    const sessionId = getSessionId();
    await http.post("/user/session/heartbeat", { userId, sessionId });
  } catch (error) {
    // Silent fail - don't disrupt user experience
  }
};

export { getSessionId, parseUserAgent };
