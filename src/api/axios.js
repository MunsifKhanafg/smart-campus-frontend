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
    return `Cannot reach the server at ${API_URL}. Start it with "npm run dev" in the server folder and read the red message in that terminal.`;
  }
  const d = err.response?.data;
  if (d?.details?.length) {
    return `${d.message}: ${d.details.map((x) => x.message || x.field).join(', ')}`;
  }
  return d?.message || err.message || 'Something went wrong';
};

export const assetUrl = (p) => (p ? `${API_URL}${p}` : '');

export default api;
