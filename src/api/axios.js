import axios from 'axios';

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export const TOKEN_KEY = 'sc_token';

const api = axios.create({ baseURL: `${API_URL}/api` });

// Attach the JWT to every request.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the server says the session is invalid, clear it and go to login.
api.interceptors.response.use(
  (res) => {
    // Sliding session: the server hands an active user a fresh token now and then. Keep it.
    const renewed = res.headers?.['x-renewed-token'];
    if (renewed) localStorage.setItem(TOKEN_KEY, renewed);
    return res;
  },
  (err) => {
    const isLoginCall = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !isLoginCall) {
      localStorage.removeItem(TOKEN_KEY);
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// Turns any axios error into a readable message.
export const errorMessage = (err) => {
  // No response at all: the server is not running, crashed on start, or the browser blocked the call (CORS).
  if (err.request && !err.response) {
    const local = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(API_URL);
    if (local) {
      return `Cannot reach the server at ${API_URL}. Start it with "npm run dev" in the server folder and read the red message in that terminal.`;
    }
    // Deployed (for example on Vercel). "No response" almost always means the browser BLOCKED the call (CORS) or the server function crashed.
    return `Cannot reach the server at ${API_URL}. 1) Open ${API_URL}/api/health in a new tab: if it does not show "Smart Campus API running", the server deployment has a problem (Vercel > Logs). 2) If it does, the server setting CLIENT_URL must be exactly ${window.location.origin} (no / at the end). Change it in the server's Vercel project, then redeploy.`;
  }
  const d = err.response?.data;
  if (d?.details?.length) {
    return `${d.message}: ${d.details.map((x) => x.message || x.field).join(', ')}`;
  }
  return d?.message || err.message || 'Something went wrong';
};

export const assetUrl = (p) => (p ? `${API_URL}${p}` : '');

export default api;
