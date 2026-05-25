import React, { createContext, useContext, useReducer, useEffect } from 'react';

const SettingsContext = createContext(null);

const parseJwt = (token) => {
  if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
    return null;
  }
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error parsing JWT token:', error);
    return null;
  }
};

const initialState = {
  activeSection: window.location.hash.slice(1) || 'profile',
  searchQuery: '',
  user: null,
  userRole: null,
  organizationId: null,
  theme: localStorage.getItem('settings-theme') || 'system',
  loading: true,
};

function settingsReducer(state, action) {
  switch (action.type) {
    case 'SET_ACTIVE_SECTION':
      return { ...state, activeSection: action.payload };
    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.payload };
    case 'SET_USER':
      return { ...state, user: action.payload, loading: false };
    case 'SET_USER_ROLE':
      return { ...state, userRole: action.payload };
    case 'SET_ORGANIZATION_ID':
      return { ...state, organizationId: action.payload };
    case 'SET_THEME':
      localStorage.setItem('settings-theme', action.payload);
      return { ...state, theme: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    default:
      return state;
  }
}

export const SettingsProvider = ({ children }) => {
  const [state, dispatch] = useReducer(settingsReducer, initialState);

  useEffect(() => {
    const token = localStorage.getItem('idToken');
    const payload = parseJwt(token);

    if (payload) {
      const role = payload['custom:role'] || 'member';
      const orgId = payload['custom:organization_id'] || null;

      dispatch({ type: 'SET_USER_ROLE', payload: role });
      dispatch({ type: 'SET_ORGANIZATION_ID', payload: orgId });
      dispatch({
        type: 'SET_USER',
        payload: {
          userId: payload['custom:user_id'] || payload.sub || payload.email,
          email: payload.email,
          cognitoId: payload['cognito:username'] || payload.sub,
        },
      });
    } else {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, []);

  return (
    <SettingsContext.Provider value={{ state, dispatch }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export default SettingsContext;
