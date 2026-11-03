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
  (res) => res,
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
  const d = err.response?.data;
  if (d?.details?.length) {
    return `${d.message}: ${d.details.map((x) => x.message || x.field).join(', ')}`;
  }
  return d?.message || err.message || 'Something went wrong';
};

export const assetUrl = (p) => (p ? `${API_URL}${p}` : '');

export default api;
