import axios from 'axios';

// ── Single source of truth for the backend URL ─────────────────────────────
const BASE_URL = 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the stored token to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ekagra_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// A deactivated account is signed out everywhere on its next request
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error?.response?.data?.detail;
    if (
      error?.response?.status === 403 &&
      typeof detail === 'string' &&
      detail.includes('deactivated') &&
      localStorage.getItem('ekagra_token')
    ) {
      localStorage.removeItem('ekagra_token');
      localStorage.removeItem('ekagra_role');
      window.location.assign('/login');
    }
    return Promise.reject(error);
  }
);

export default api;
